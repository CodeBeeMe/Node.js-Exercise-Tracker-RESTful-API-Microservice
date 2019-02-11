'use strict';

const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const cors = require('cors');
const mongoose = require('mongoose');
const shortid = require('shortid');

mongoose.connect(process.env.MLAB_URI || 'mongodb://localhost/exercise-track' );

app.use(cors());

app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

app.use(express.static('public'));
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});

//===============================================

let savedUsers = []; //aray holding the documents ready to be posted to the DB

const userSchema = new mongoose.Schema({
  username: String,
  _id: String,
  exercise: [{
    description: String,
    duration: Number,
    date: String
  }]  
});

const User = mongoose.model('User', userSchema);

//Get input from client - using the Route parameters
//Getting an array with all the users, having only the _id and username properties
app.get('/api/exercise/:users?', (req, res) => {
    //get an array with all the users in the DB"
    User
      .find({username: /^.{2,15}$/i})
      .select('-exercise -__v')
      .exec((err, doc) => {
      err ? console.log(err) : res.json(doc);
      console.log(doc);
    });
  });


//get the user's document with a log for total exercises added and total exercise count
app.get('/api/exercise/log/:_id?', (req, res) => {
  const userId = req.params._id;    
    User
      .findById(userId)
      .select('-__v')
      .exec((err, doc) => {
      err ? console.log(err) : res.json({User_document: doc, Total_exercise_count: doc.exercise.length});      
      console.log(doc);
    });
  });



app.post('/api/exercise/new-user', (req, res) => {
  const newUser = req.body.username;  
  const validUser = (/^.{2,15}$/i).test(newUser);  
  console.log(newUser);
  
  if(validUser) {
    User.find({ username: newUser }, '-__v', (err, doc) => {
      if (err) {
        console.log(err);
      } else {
        if (doc[0] !== undefined) { //a document matching the username property has been found
          res.json("username already taken"); //view the original entry
        } else { //no match so proceed to add new docs
          savedUsers.push({username: newUser, _id: shortid.generate(), exercise: []}); //populating the savedUsers array with objects for the newly added users
          res.json({username: savedUsers[0].username, _id: savedUsers[0]._id});
          console.log();
          //savind all objects fron the savedUsers array as documents in the DB
          User.create(savedUsers,  (err, users) => {
            err ? console.log(err) : console.log(users);
            savedUsers = [];
          });
          console.log(savedUsers);
        }
      }
    });
  } else res.json("invalid username");
});

app.post('/api/exercise/add', (req, res) => {
  const userId = req.body.userId;
  const details = req.body.description;
  const length = req.body.duration;
  let date = req.body.date;
  
  date ? date = new Date(date).toDateString() : date = new Date().toDateString();
  
  console.log(userId + ' ' + details + ' ' + length + ' ' + date);
  if (userId) {
    User.findByIdAndUpdate(userId, {$push: {exercise: [{description: details, duration: length, date: date }] } }, (err, doc) => {
      if (err) {
        //console.log(err);
        res.json("_id not found");
      } else {
        User.find({ username: doc.username }, '-__v', (err, updatedDoc) => {
          let last = updatedDoc[0].exercise.length - 1;
          if (err) {
            console.log(err);
          } else {
            console.log(updatedDoc[0]);
            //view the last entry 
            res.json({_id: updatedDoc[0]._id, username: updatedDoc[0].username, description: updatedDoc[0].exercise[last].description, duration: updatedDoc[0].exercise[last].duration, date: updatedDoc[0].exercise[last].date});           
          }
        });
      }
    });
  } else res.json("invalid _id");
});


//===============================================

// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'});
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage;

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500;
    errMessage = err.message || 'Internal Server Error';
  }
  res.status(errCode).type('txt')
    .send(errMessage);
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port);
})
