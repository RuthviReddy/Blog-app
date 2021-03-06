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
                  cookie: {
                    secure: 'auto'
                  }
                }));

var ObjectId = require('mongodb').ObjectID;

//plugin which adds pre-save validation for unique fields within a Mongoose schema.
var uniqueValidator = require("mongoose-unique-validator");

var flash = require('connect-flash');
app.use(flash());

var twitter = require("twitter");
var client;

var passport = require('passport');

var LocalStrategy = require('passport-local').Strategy;
var FacebookStrategy = require('passport-facebook').Strategy;
var TwitterStrategy = require ('passport-twitter').Strategy;
var GoogleStrategy = require ('passport-google-oauth').OAuth2Strategy;

app.use(passport.initialize());
app.use(passport.session());


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
  function(accessToken, secretToken, profile, done) {
    
     console.log(profile._json);
    User.findOne({
      username: profile.displayName
      //'facebook.id': profile.id
    }, function(err, user) {
      if(err) {
        return done(err);
      }
      if(!user) {
        user = new User ({
          username: profile.displayName,
          provider: 'facebook',
          facebookProfile: profile._json,
          facebookTokenSecret: secretToken
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
  callbackURL: "http://127.0.0.1:1111/twitter/callback",
  userProfileURL  : 'https://api.twitter.com/1.1/account/verify_credentials.json?include_email=true',
},
  function(accessToken, secretToken, profile, done) {
    var data = profile._json;
    
    client = new twitter({
      consumer_key: 'ihFbevRggU6gmlzH0jx6VXxUh',
      consumer_secret: 'r8W2v3UNFeg3cdPOIV0CvZ2P0UF9bNERM419co7WJf0JZNYTol',
      access_token_key: accessToken,
      access_token_secret: secretToken
    });
    
     User.findOne({
      //twitterId : data.id_str
      email: data.email
    }, function(err, user) {
      
      if(err) {
        return done(err);
      }
      if(!user) {
        console.log("Creating new user through Twitter");
        user = new User ({
          twitterId: data.id_str,
          username: data.name,
          provider: 'twitter',
          twitterProfile: data,
          email: data.email,
          twitterToken: accessToken,
          twitterTokenSecret: secretToken
        });
        user.save(function (err) {
          if(err) console.log(err);
          return done(err, user);
        });
      } else if(user) {
        console.log("User email exists. Adding Twitter data to same profile");
        if(user.twitterId == null) {
          User.update({email: data.email}, {
            twitterId: data.id_str,
            twitterProfile: data,
            twitterToken: accessToken
          }, function(err,res) {
                console.log(res);
              });
        }
        
      } 
        return done(err, user);
      
    });
  }));

passport.use(new GoogleStrategy({
  clientID: "444464459567-2698m08qq32blmrf0nr6bla2j35fdum1.apps.googleusercontent.com",
  clientSecret: "TpbPxzPlWcfL38XlzV3ZDp_k",
  callbackURL: "http://localhost:1111/google/callback"
},
  function(accessToken, secretToken, profile, done) {
    
    User.findOne({
      email: profile.emails[0].value
      //googleId : profile.id
    }, function(err, user) {
      if(err) {
        return done(err);
      }
      if(!user) {
        console.log("Creating new User through Google");
        user = new User ({
          email: profile.emails[0].value,
          username: profile.displayName,
          provider: 'google',
          google: profile._json,
          googleId: profile.id,
          googleProfile: profile._json,
          googleToken: accessToken,
          googleTokenSecret: secretToken
        });
        //console.log(profile.displayName);
        user.save(function (err) {
          if(err) console.log(err);
          return done(err, user);
        });
      } else if(user){
        //console.log("Email already exists. Adding details");
        //console.log("Google id stored in users " + user.googleId);
          if(user.googleId == null) {
            User.update({email: profile.emails[0].value}, {
              google: profile._json,
              googleId: profile.id,
              googleProfile: profile._json,
              googleToken: accessToken
            }, function(err, res) {
                console.log(res);
              })
            }
      } 
        return done(err, user);
      
    });
}));

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
	email: {type: String, unique: true, required: true},
	username: {type: String, unique: true, required: true},
	passwordHash: String,
  image: String,
  provider: String,
  twitterId: String,
  facebookId: String,
  googleId: String,
  googleProfile: Object,
  twitterProfile: Object,
  facebookProfile: Object,
  twitterToken: String,
  twitterTokenSecret: String,
  facebookToken: String,
  facebookTokenSecret: String,
  googleToken: String,
  googleTokenSecret: String
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
  username: String,
  title: String,
  blogpost: String,
  user_image: String,
  likes: {type : Number, default: 0},
  likedBy: [String],
  comments : { type : Array , "default" : [] }
});

postSchema.plugin(timestamps);
var Post = mongoose.model('Post', postSchema);

var followerSchema = new mongoose.Schema(
  {
    user: String,
    followers: {
      type:Array, 
      "default": [] 
    }
  });

var Follower = mongoose.model('Follower', followerSchema);

var timelineSchema = new mongoose.Schema({
  user: String,
  postsFeed: {
    type: Array,
    "default": []
  }
});

var Timeline = mongoose.model('Timeline', timelineSchema);


//ROUTES
var sess;
app.get('/', function(req, res) {
  
   res.render('signin');
});

function loggedIn(req, res, next) {
    if (req.user) {
        next();
    } else {
        res.redirect('/');
    }
}

app.get('/signup', function (req, res, next) {
    res.render('signup');
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
  successRedirect: '/feed',
  failureRedirect: '/',
  failureFlash: true
})
  
);

//register with passport
app.post('/signup', function(req, res, err){
  var user = new User();
  user.username = req.body.username;
  user.email = req.body.email;
  user.password = req.body.password;

  user.save(function(err, user) {
    if(err) {
    console.log("Validation error");
    throw err;
    req.flash("Sorry");
    res.redirect('/signup');
    } else {
      var data = user.username;
      var follower = new Follower({
        user: data
      });
      follower.save(function(err, result) {
        if(err) {
          throw err;
          console.log(err);
        }
      });

      var timeline = new Timeline({
        user: data
      });
      timeline.save(function(err, result) {
        if(err) {
          throw err;
          console.log(err);
        }
      });

      res.redirect('/');
    }
  });
});

app.get('/facebook', passport.authenticate('facebook', {scope: ['public_profile', 'email'] }));

app.get('/facebook/callback', passport.authenticate('facebook', {failureRedirect: '/signin'}),
  function(req,res) {
    res.redirect('/feed');
  });

app.get('/twitter', passport.authenticate('twitter'));

app.get('/twitter/callback', passport.authenticate('twitter', {failureRedirect: '/signin'}),
  function(req, res) {
    res.redirect('/feed');
  });

app.get('/google', passport.authenticate('google', {scope: 'https://www.googleapis.com/auth/plus.me https://www.google.com/m8/feeds https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile'}));

app.get('/google/callback', passport.authenticate('google', {failureRedirect: '/signin'}),
  function(req, res) {
    res.redirect('/feed');
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

app.get('/feed', loggedIn, function(req, res){
    sess = req.session;
    sess.username = req.user.username;

    Timeline.findOne({user: sess.username}, function(err, timeline) {
      var l = (timeline.postsFeed).length;
      var limit = 10;
      if(l < 10) {
        limit = l;
      }
      var i;
      var data = [];
      var postIdArr = [];
      for(i=0; i<limit; i++) 
      {
          var pID = ObjectId(timeline.postsFeed[l-1].id);
          postIdArr.push( pID );
          l--;
      }
      
      Post.find({_id: {$in: postIdArr}}, function(err, output) {
        data = output;
        res.render('feed', {data: data, username: sess.username});
      });
    });
});

//ejs route
app.get('/home', loggedIn, function(req, res){
      
      sess = req.session;
      sess.username = req.user.username;
      res.render('home', {username: sess.username});
      
});

app.get('/yourProfile',loggedIn ,function(req, res){
  
  var img;
  var f = 0;
  Follower.findOne({user: sess.username}, function(err, obj) {
    if(obj != null)
    {
      f = obj.followers.length;
    }
  });
  User.findOne({username: sess.username}, function(err, user) {
      img = user.image;

      Post.find({username: sess.username}, function(err,posts){
        var postObj = {};
        postObj.image = img;
        postObj.posts = posts;
        postObj.username = sess.username;
        
        res.render('yourProfile', {data: postObj, f:f})
      });
  });
});

app.get('/new', loggedIn, function(req, res) {
  var f = 0;
  Follower.findOne({user: sess.username}, function(err, obj) {
    if(obj != null)
    {
      f = obj.followers.length;
    }
  });
  Post.find({username: sess.username}).sort({createdAt : 'descending'}).exec(function(err, posts) {
    var postObj = {};
        postObj.posts = posts;
    res.render('yourProfile', {data: postObj, f:f})
  });
});

app.get('/old', loggedIn, function(req, res) {
  var f = 0;
  Follower.findOne({user: sess.username}, function(err, obj) {
    if(obj != null)
    {
      f = obj.followers.length;
    }
  });
  Post.find({username: sess.username}).sort({createdAt : 'ascending'}).exec(function(err, posts) {
    var postObj = {};
        postObj.posts = posts;
    res.render('yourProfile', {data: postObj, f:f})
  });
});

app.get('/newFeed', loggedIn, function(req, res) {
      sess = req.session;
      sess.username = req.user.username;
  Post.find().sort({createdAt : 'descending'}).exec(function(err, posts) {
    res.render('feed', {posts: posts, username: sess.username})
  });
});

app.get('/oldFeed', loggedIn, function(req, res) {
      sess = req.session;
      sess.username = req.user.username;
  Post.find().sort({createdAt : 'ascending'}).exec(function(err, posts) {
    res.render('feed', {posts: posts, username: sess.username})
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
var text;
var counter = 0;
app.post('/publishPost', loggedIn , function(req, res){
      
  if(req.body.tweet == 'on')
    {
      counter = 1;
    }
    var postData = {
      username: sess.username,
      title: req.body.title,
      blogpost: req.body.editor_content,
    }

    Post.create(postData, function(err, post) {
      if(err) {
        return next(err);
      } else {
        
        if(counter == 1) {
          text = "Check out my blog post: http://127.0.0.1:1111/viewPost/"+post._id;
          console.log("The tweet will be "+text);
          client.post('statuses/update', {screen_name: req.user.twitterProfile.screen_name, status: text}, function(err, tweet, response) {
            if(err) {
              console.log(err); 
              throw err;
            }
          });
        }

        Follower.findOne({user: sess.username}, function(err, followObj) {
          if(err) {
            throw err;
            console.log(err);
          } else if(followObj != null){

            var n = (followObj.followers).length;
            console.log("The number of followers are "+ n);
            var i;

            for(i=0; i<n;i++)
            {
              var q = followObj.followers[i];
              db.collection('timelines').update({user: q.followerName}, {$push: {
                postsFeed : {
                  "id": post._id
                }
              }});
            }
          }
        });
        
        return res.redirect('/yourProfile');
      }    
    });
});

app.get('/deletePost/:id', loggedIn, function(req,res) {
  
  var id = req.params.id;
  var o_id = ObjectId(id);
  db.collection('posts').findAndRemove({_id:o_id} , function(err) {
    if(err) { res.send(err); }
    res.redirect('/yourProfile');
    console.log("Post deleted successfully!");
  });
});

app.get('/editPost/:id', loggedIn, function(req, res) {
  var id = req.params.id;
  var o_id = ObjectId(id);
  db.collection('posts').find({_id: o_id}).toArray(function(err, result) {
    if (err) return console.log(err)
   res.render('edit',{posts: result});
    
  });
  
});


app.get('/viewProfile/:Author', loggedIn, function(req,res) {
  if(req.params.Author != 'textversion.js')
  var name = req.params.Author;

  var counter = 0;
  db.collection('posts').find({username : name}).toArray(function(err, result) {
    if(err) return console.log(err);

    var f=0;
    Follower.findOne({user: name}, function(err, obj) {
      if(obj != null)
      f = obj.followers.length;
    });
    
    Follower.findOne({user: name, "followers.followerName" : sess.username}, function(err, followObj) {
      if(followObj == null ) {
        res.render('profile', {posts: result, username: name, counter: counter, f:f, name: sess.username});
      }

      else {
        counter = 1;
        res.render('profile', {posts: result, username: name, counter: counter, f:f, name: sess.username});
      }
    });
  });
});


app.post('/edit',function(req, res) {
  
 db.collection('posts').update ({ _id: ObjectId(req.body._id) }, {$set: {
    title: req.body.title,
    blogpost: req.body.blogpost
 }
 }, function (err, result) {
      if (err) {
      console.log(err);
    } else {
     console.log("Post Updated successfully");
     var f = 0;
  Follower.findOne({user: sess.username}, function(err, obj) {
    if(obj != null)
    {
      f = obj.followers.length;
    }
  });
     Post.find({username: sess.username}, function(err,posts) {
    res.render('yourProfile', {posts: posts, f:f})
  });
 }
})});

app.get('/viewPost/:id', function(req, res) {
  sess = req.session;
  sess.username = req.user.username;
  var id = req.params.id;
  var o_id = ObjectId(id);
  var img;
  
  User.findOne({username:sess.username}, function(err, user) {
    img = user.image;
    
    Post.find({_id: o_id}, function(err, posts) {
        var postObj = {};
        postObj.image = img;
        postObj.posts = posts;
        res.render('view', {data:postObj, username: sess.username});
    })
  });
});


app.post('/like', function(req, res) {
  
  console.log("In the like route");
  sess = req.session;
  sess.username = req.user.username;
  var id = req.body.postId;
  var o_id = ObjectId(id);
  var likesCount = req.body.likesCount;
  console.log(likesCount);
  db.collection('posts').update ({ _id: o_id }, 
    {$inc: { likes: 1} , $push: {likedBy: sess.username}}, 
    function (err, result){
      if(err) {
        console.log(err);
      } else {
        console.log("Like updated");
      }
 });
});

app.get('/commentPost/:id', loggedIn, function(req, res) {

  
  var commentUsername = req.user.username;
  var commentField = req.query.comment;
  var id = req.params.id;
  var o_id = ObjectId(id);
  var date = new Date();
  db.collection("posts").update({_id: o_id}, {$push: {
      comments: {
        "username" : commentUsername,
        "comment" : commentField,
        "createdAt": date
      }
    }
  }, function(err, res) {
    if(err) {
      throw err;
      console.log(err);
    } 
  }); 
  Post.find({_id: o_id}, function(err, posts) {
         var postObj = {};
         postObj.posts = posts;
        res.render('view', {data:postObj, username: commentUsername});
  }); 
});

app.get('/account', loggedIn, function(req, res) {
  res.render('account');
});

app.get('/viewComments/:id', loggedIn, function(req, res) {
  sess = req.session;
  sess.username = req.user.username;
  var id = req.params.id;
  var o_id = ObjectId(id);
  Post.find({_id: o_id}, function(err, posts) {
    var postObj = {};
        postObj.posts = posts;
    res.render('viewComments', {data: postObj, username: sess.username});
  });
});


app.post('/follow', loggedIn, function(req, res, next) {
  console.log(req.user.username + " wants to follow "+ req.body.target);
  db.collection('followers').update({user: req.body.target}, {$push: {
    followers: {
      "followerName": req.user.username
    }
  }}); 
  res.redirect('/viewProfile/'+req.body.target); 
});


app.post('/unfollow', loggedIn, function(req, res, next) {
  console.log(req.user.username + " wants to unfollow "+ req.body.target);
  db.collection('followers').update({user: req.body.target}, {$pull: {
    followers: {
      "followerName": req.user.username
    }
  }});
  res.redirect('/viewProfile/'+req.body.target);
});

app.get('/explore', loggedIn, function(req,res,next) {
  sess = req.session;
  sess.username = req.user.username;
  Post.find({username: { $ne: sess.username} }, function(err,posts) {
    var data = posts;
    res.render('explore', {data: posts, username: sess.username});
  });
});


app.listen(port, '0.0.0.0', function() {
 console.log('Server running at port ' + port);
});