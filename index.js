const express = require('express')
const app = express()

const bodyParser = require("body-parser")
const methodOverride = require("method-override");
const mongoose = require("mongoose");
const jwt = require('jsonwebtoken');
const cookieParser = require("cookie-parser");
const secretKey = 'gauravsourav';
let TOKEN;

const bcrypt = require('bcrypt');
const saltRounds = 10;

app.set("view engine","ejs");
app.use(bodyParser.urlencoded({ extended:true }));
app.use(methodOverride("_method"));

app.use(express.json());
app.use(cookieParser());

//let loggedin = false;

//db connection
mongoose.connect("mongodb+srv://root:root@cluster0.jypbz.mongodb.net/goal_tracker")
.then(() => console.log('Db connected'))
.catch((err) => console.log(err));

//User info table
var userSchema = new mongoose.Schema({
    name:String,
    email:String,
    password:String
})

const User = mongoose.model("User",userSchema);
// ################################

//Goal info table
var goalSchema = new mongoose.Schema({
    goal:String,
    start_date:String,
    end_date:String,
    desc: String,
    user_id: String
})
const Goal = mongoose.model("Goal",goalSchema);

// ################################
const PORT = 3003 || process.env.PORT

function formatDate(date) {
    date = new Date(date);
    const day = `${date.getDate() < 10 ? '0' : ''}${date.getDate()}`;
    const month = `${date.getMonth() + 1 < 10 ? '0' : ''}${date.getMonth() + 1}`;
    const year = date.getFullYear();
    return `${year}-${month}-${day}`;
}

//Middleware func
//check if user is logged in
// async function isAuthenticated(id)
// {
//     const user = await User.findById(id);
//     return user.logStatus
// }
async function retrieveGoalsById(id)
{
    let goals = await Goal.find({user_id:id})
    return goals;
}
function verifyJwtToken(req,res,next)
{
    const token = req.cookies.token;
    //decode token and retrieve user_id
    
    console.log('token:middleware:',token)
    if(typeof token !== 'undefined')
    {

        jwt.verify(token, secretKey, (err, authData)=>{
            if(err)
            {
                console.log('Not authorized');
                res.redirect('/login');
            }
            else{
                //req.token = logic
                console.log('authData: ',authData.searched_user._id)
                if(req.params.id === authData.searched_user._id)
                {
                    next();
                }
                else{
                    // req.newUserId = authData.searched_user._id
                    // console.log('#id1:', req.newUserId);
                    // next();
                    res.redirect('/login');
                }
                
            }
        })
        
    }
    else{
        console.log('token expired/invalid');
        res.redirect('/login');
    }
}
//password hash and unhash func
//hash password

// function hash_password(myPlaintextPassword)
// {
//     //let hashed_password = ''
//     let hashed_password = bcrypt.hash(myPlaintextPassword, saltRounds, function(err, hash) {
//         // Store hash in your password DB.
//         console.log('in hash****************')
//        // hashed_password += hash;
//     });
//     return hashed_password;
// }

// //compare plain password with hashed password
// function compare_password(myPlaintextPassword, hash)
// {
//     let password_matched = false;
//     bcrypt.compare(myPlaintextPassword, hash, function(err, result) {
//         password_matched = result;
//     });

//     return password_matched;
// }


app.get('/',(req,res)=>{
    res.render('home');
})

app.get('/home/:id',verifyJwtToken,async (req,res)=>{
    //console.log('#id2:', req.para);
    const user = await User.findById(req.params.id);
        //res.send('Login Successful');
        //retrieve goal of logged in user
        let goals = await retrieveGoalsById(req.params.id);
        console.log('Printing goals of logged in user:')
        console.log(goals);
        res.render('goal_page', {id: req.params.id, goals: goals})
        
        console.log('Logged in user: ', user)

})

app.get('/login',(req,res)=>{
    res.render('login')
})

app.get('/logout/:id',async (req,res)=>{
    let user = await User.findById(req.params.id);
    //user.logStatus = false;
    //await User.findByIdAndUpdate(req.params.id, user);
    res.clearCookie("token");
    console.log('logged out user:', user);
    res.redirect('/');
})

app.post('/login',async (req,res)=>{
    //res.send('login page')
    //check if user exist in db
    const {email, password} = req.body;
    let searched_user = await User.findOne({email}).exec();
    if(searched_user)
    {
        //check for password
        //if(searched_user.password == password)

        //if(compare_password(password, searched_user.password))
        if(bcrypt.compareSync(password, searched_user.password))
        {
            //password matched
            console.log('pass: ',searched_user);
            const id = searched_user._id;
            await User.findByIdAndUpdate(id, searched_user)
            //loggedin = true;
            

            //Generate jwt token
            jwt.sign({searched_user}, secretKey, {expiresIn: '60s'}, (err, token)=>{
                console.log('#token: '+token);
                //TOKEN = token;
               // res.json({ token });
                res.cookie('token', token, { expires: new Date(Date.now() + 86400000), httpOnly: true, secure: true });
                res.redirect('/home/'+searched_user._id);
            })

            

        }
        else{
            console.log('password invalid');
            res.redirect('/login');
        }
    }
    else{
        console.log("Email doesn't exist");
        res.redirect('/login');
    }

})

app.get('/signUp',(req,res)=>{
    res.render('signup')
})

app.post('/signUp',async (req,res)=>{
    //res.send('signUp page')
    //save user data to db
    const myPlaintextPassword = req.body.password

    let hashed_password = bcrypt.hashSync(myPlaintextPassword, saltRounds);
    let user = {
        name: req.body.name,
        email:req.body.email,
        password: hashed_password,
    }
    const email = req.body.email;
    console.log(user);
    console.log('email: ', user.email);
    const searched_user = await User.findOne({email}).exec();
    console.log('searched_user: ',searched_user)
    if(searched_user)
    {
        console.log('user already exist')
        res.redirect('/login')
    }
    else{
    await User.create(user);
    res.redirect('/login')
    }

})

//Goals route:
app.post('/goals/:id',verifyJwtToken, async(req,res)=>{
    
    console.log('goal in post:')
    console.log(typeof req.params.id)
    console.log(req.body)

        console.log('+token: ',TOKEN);
        let newGoal = {
            goal:req.body.goal,
            start_date: formatDate(req.body.start_date),
            end_date:formatDate(req.body.end_date),
            desc: req.body.desc,
            user_id:req.params.id
        }
        await Goal.create(newGoal);
    res.redirect('/home/'+ req.params.id)
})

app.get('/goals/:id/:goal_id/edit',verifyJwtToken, async (req,res)=>{
        let goal = await Goal.findById(req.params.goal_id);
        res.render('edit_goal',{goal:goal});

})

app.put('/goals/:id/:goal_id/edit',verifyJwtToken, async (req,res)=>{
        let originalGoal = await Goal.findById(req.params.goal_id);
        let passedGoal = req.body.goal
        for(let key in passedGoal)
        {
            if(passedGoal[key] === '')
            {
                passedGoal[key] = originalGoal[key];
            }
        }
        // let updatedGoal = {
        //     ...originalGoal,
        //     passedGoal
        // }
        await Goal.findByIdAndUpdate(req.params.goal_id, passedGoal);
        res.redirect('/home/'+req.params.id);
})

app.delete('/goals/:id/:goal_id/',verifyJwtToken, async (req,res)=>{
        await Goal.findByIdAndDelete(req.params.goal_id);
        res.redirect('/home/'+req.params.id);
})

app.listen(PORT, ()=>{
    console.log('server is running at port: ', PORT);
})