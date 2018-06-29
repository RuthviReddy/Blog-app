var http = require('http');

var express = require('express');
var app = express();

var port=1111;

var mongoose = require('mongoose');

var bodyParser = require('body-parser');

var timestamps = require('mongoose-timestamp');

var moment = require('moment');
//moment().format();
app.locals.moment = require('moment');
exports.index = function(req, res) {
    res.render('profile', { moment: moment });
}

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));

//for the ejs engine
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');

var bcrypt = require('bcrypt');
var salt = 10;

var connectMongo = require ('connect-mongo');
var session = require('express-session');
app.use(session ({key: 'user_sid',
                  secret: 'secretToSession', 
                  saveUninitialized: false, 
                  resave: true,
                  //cookie: { maxAge: 1209600000 }
                }));

var ObjectId = require('mongodb').ObjectID;

/*app.use(function(req, res, next) {
  var sess = req.session;
  if(sess.views) {
    res.setHeader('Content-Type', 'text/html');
          res.write('<p>views: ' + sess.views + '</p>');
          res.end();
          sess.views++;
          console.log(sess.views);
  } else {
    sess.views = 1;
    console.log("You're coming here for the first time!");
  }
});*/

//plugin which adds pre-save validation for unique fields within a Mongoose schema.
var uniqueValidator = require("mongoose-unique-validator");

var flash = require('connect-flash');
app.use(flash());

var passport = require('passport');

var LocalStrategy = require('passport-local').Strategy;
var FacebookStrategy = require('passport-facebook').Strategy;
var TwitterStrategy = require ('passport-twitter').Strategy;
var GoogleStrategy = require ('passport-google-oauth').OAuth2Strategy;

app.use(passport.initialize());
app.use(passport.session());


//serializing and deserializing tell Passport how to store Users in
//and retrieve them from sessions
passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

//normal login on the app
var local = new LocalStrategy(function(username, password, done) {
  User.findOne({ username }, function(err, user) {
      if(!user || !user.validPassword(password)) {
        console.log("Invalid username or password");
        //req.flash("Invalid username or password");
        done(null, false);
      } else {
        console.log("Login successful");
        done(null, user);
      }
    });
});

passport.use("local",local);


//login through Facebook
passport.use(new FacebookStrategy({
    clientID: "425950064536469",
    clientSecret: "a1a0fcee810d00b46e5385c7c4906f44",
    callbackURL: "http://localhost:1111/facebook/callback"
  },
  function(accessToken, refreshToken, profile, done) {
    
    User.findOne({
      'facbook.id': profile.id
    }, function(err, user) {
      if(err) {
        return done(err);
      }
      if(!user) {
        user = new User ({
          username: profile.username,
          provider: 'facebook',
          facebook: profile._json
        });
        //console.log(username);
        user.save(function(err) {
          if(err) console.log(err);
          return done(err, user);
        });
      } else {
        return done(err, user);
      }
    });
  }
));

//login through Twitter
passport.use(new TwitterStrategy({
  consumerKey: "ihFbevRggU6gmlzH0jx6VXxUh",
  consumerSecret: "r8W2v3UNFeg3cdPOIV0CvZ2P0UF9bNERM419co7WJf0JZNYTol",
  callbackURL: "http://127.0.0.1:1111/twitter/callback"
},
  function(accessToken, refreshToken, profile, done) {
    User.findOne({
      'twitter.id' : profile.id
    }, function(err, user) {
      if(err) {
        return done(err);
      }
      if(!user) {
        user = new User ({
          username: profile.username,
          provider: 'twitter',
          twitter: profile._json
        });
        user.save(function (err) {
          if(err) console.log(err);
          return done(err, user);
        });
      } else {
        return done(err, user);
      }
    });
  }));

passport.use(new GoogleStrategy({
  clientID: "444464459567-2698m08qq32blmrf0nr6bla2j35fdum1.apps.googleusercontent.com",
  clientSecret: "TpbPxzPlWcfL38XlzV3ZDp_k",
  callbackURL: "http://localhost:1111/google/callback"
},
  function(accessToken, refreshToken, profile, done) {
    User.findOne({
      'google.id' : profile.id
    }, function(err, user) {
      if(err) {
        return done(err);
      }
      if(!user) {
        user = new User ({
          username: profile.username,
          provider: 'google',
          google: profile._json
        });
        console.log(profile.username);
        user.save(function (err) {
          if(err) console.log(err);
          return done(err, user);
        });
      } else {
        return done(err, user);
      }
    });
}));

module.exports = passport;


//establishing the mongoDB connection
var mongoDB = 'mongodb://127.0.0.1/list';
mongoose.connect(mongoDB);
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', function(){
	console.log("MongoDB connected!");
});


//defining the UserSchema
var UserSchema = new mongoose.Schema({
	email: String,
	username: String,
	passwordHash: String,
  //blogposts: [{type: Schema.Types.ObjectId, ref: 'Post'}]

});

UserSchema.plugin(uniqueValidator);
UserSchema.methods.validPassword = function(password) {
  return bcrypt.compareSync(password, this.passwordHash);
};
UserSchema.virtual("password").set(function(value) {
  this.passwordHash = bcrypt.hashSync(value, salt);
});

var User = mongoose.model('User', UserSchema);

//creating a Schema for the blog posts
var postSchema = new mongoose.Schema({
  username: String,//{type: Schema.Types.ObjectId, ref: 'User'},
  title: String,
  blogpost: String,
  //time : { type : Date, default: Date.now }

});

postSchema.plugin(timestamps);
var Post = mongoose.model('Post', postSchema);




//routes
//adding the homepage route
/*app.get('/', ensureAuthenticated, function (req, res, next) {	
  	
 res.sendFile( __dirname + '/signin.html');
});*/
var sess;
app.get("/", ensureAuthenticated, (req, res) => {
  
   res.render('signin');
});

function ensureAuthenticated(req, res, next) {
  if(req.isAuthenticated()) { 
    return next();
  }
  res.sendFile(__dirname + '/signin.html');
}

app.get('/signup', function (req, res, next) {
    res.sendFile( __dirname + '/signup.html');
});

//without Passport
/*app.post('/signin', function (req, res, next) {

	User.findOne({username: req.body.username}, function(err, user){
        var result = bcrypt.compareSync(req.body.password, user.password);
        console.log(result);
        if(result) {
        	console.log("Sign in successful!");
			res.redirect('/home');
        }
        else {
			console.log("Error in Sign in.");
			res.status(500).send('Invalid username or password!');
		}	

	});
});*/

//login with Passport
app.post('/signin', passport.authenticate("local", {
  successRedirect: '/home',
  failureRedirect: '/',
  failureFlash: true
})
  
);

//register with passport
app.post('/signup', (req, res, next) => {
  var { username, password } = req.body;
  
  User.create({username, password })
    .then(user => {
      req.login(user, err => {
        if(err) next(err);
        else res.redirect('/');
      });
    })
    .catch(err => {
      if(err.name === "Validation error") {
        req.flash("Sorry");
        res.redirect('/signup');
      } else next (err);
    });
});

app.get('/facebook', passport.authenticate('facebook'));

app.get('/facebook/callback', passport.authenticate('facebook', {failureRedirect: '/signin'}),
  function(req,res) {
    res.redirect('/home');
  });

app.get('/twitter', passport.authenticate('twitter'));

app.get('/twitter/callback', passport.authenticate('twitter', {failureRedirect: '/signin'}),
  function(req, res) {
    res.redirect('/home');
  });

app.get('/google', passport.authenticate('google', {scope: 'https://www.googleapis.com/auth/plus.me https://www.google.com/m8/feeds https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile'}));

app.get('/google/callback', passport.authenticate('google', {failureRedirect: '/signin'}),
  function(req, res) {
    res.redirect('/home');
  });

/*app.post('/signup', function (req,res,next) {
	
	var hashPassword = bcrypt.hashSync(req.body.password, salt);
	req.body.password = hashPassword;
	console.log(req.body.password); 

	User.create(req.body, function(err, saved) {
		if (err) {
				console.log(err);
				res.json({message: err});
		}
		else {
				res.json({message: "User has been successfully registered!"});
		}
	});		
});*/

/*app.get('/home',  function(req, res, next) {
	res.sendFile(__dirname + '/home.html');
  
});*/
app.get('/feed', ensureAuthenticated, (req, res) => {
  //console.log(req.username);
  Post.find({}, (err,posts) => {
    res.render('profile', {posts: posts})
  });
});


//ejs route
app.get("/home", ensureAuthenticated, (req, res) => {
      //console.log(req.user.username);
      sess = req.session;
      sess.username = req.user.username;
      //console.log(sess.username);
      res.render('home', {username: sess.username});
      
});


app.get("/posts", ensureAuthenticated, (req, res) => {
  //console.log(req.username);
  Post.find({username: sess.username}, (err,posts) => {
    res.render('profile', {posts: posts})
  });
});

app.get("/new", function(req, res) {
  Post.find({username: sess.username}).sort({createdAt : 'descending'}).exec(function(err, posts) {
    res.render('profile', {posts: posts})
  });
});

app.get("/old", function(req, res) {
  Post.find({username: sess.username}).sort({createdAt : 'ascending'}).exec(function(err, posts) {
    res.render('profile', {posts: posts})
  });
});

app.get('/logout', function (req, res, next) {
    req.logout();
    res.redirect('/');
});

/*app.post('/publishPost', function(req, res, next) {
  var postBody = req.body;
  Post.create(req.body, function(err, saved) {
    if (err) {
        console.log(err);
        res.json({message: err});
    }
    else {
        res.json({message: "Your post has been successfully published!"});
    }
  });
});*/


//ejs route
app.post('/publishPost', ensureAuthenticated, (req, res) => {
      var postData = {
      username: sess.username,
      title: req.body.title,
      blogpost: req.body.blogpost,
    }

    Post.create(postData, function(err, post) {
      if(err) {
        return next(err);
      } else {
        return res.redirect('/posts');
      }
        
    });

});

app.get('/deletePost/:id', function(req,res) {
  //console.log(req.params.id);
  console.log("Inside the delete route");
  var id = req.params.id;
  //console.log(id);
  var o_id = ObjectId(id);
  db.collection('posts').findAndRemove({_id:o_id} , function(err) {
    if(err) { res.send(err); }
    res.redirect('/posts');
    console.log("Post deleted successfully!");
  });
});

app.get('/editPost/:id', function(req, res) {
  var id = req.params.id;
  //console.log(id);
  var o_id = ObjectId(id);
  db.collection('posts').find({_id: o_id}).toArray((err, result) => {
    if (err) return console.log(err)
   //console.log(result);
   res.render('edit',{posts: result});
    
  });
  //console.log(req.params.id);
});

app.post('/edit',(req, res) => {
 db.collection('posts').update ({ _id: ObjectId(req.body._id) }, {$set: {
    title: req.body.title,
    blogpost: req.body.blogpost
 }
 }, function (err, result) {
      if (err) {
      console.log(err);
    } else {
     console.log("Post Updated successfully");
     Post.find({username: sess.username}, (err,posts) => {
    res.render('profile', {posts: posts})
  });
 }
})});

app.get('/viewPost/:id', function(req, res) {
  var id = req.params.id;
  //console.log(id);
  var o_id = ObjectId(id);
  db.collection('posts').find({_id: o_id}).toArray((err, result) => {
    if (err) return console.log(err)
   //console.log(result);
   res.render('view',{posts: result});
    
  });
  //console.log(req.params.id);
});

app.listen(port, '0.0.0.0', function() {
 console.log('Server running at port ' + port);
});