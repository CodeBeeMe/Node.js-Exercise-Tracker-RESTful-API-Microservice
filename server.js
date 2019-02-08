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
  description: String,
  duration: Number,
  date: String
});

const User = mongoose.model('User', userSchema);
/*
//Get input from client - using the Route parameters
app.get('/api/exercise/:new-user?', (req, res) => {
  const newUser = req.params.username;
    //find the document that has the "short_url" property associated with the entered numeric parameter and then redirect the page to the "original_url"
    User.find({ _id: newUser}, (err, doc) => {
      err ? console.log(err) : res.redirect(doc[0].original_url);
    });
  });*/



app.post('/api/exercise/new-user', (req, res) => {
  const newUser = req.body.username;
  console.log(newUser);
  if(newUser) {
    User.find({ username: newUser }, '-__v', (err, doc) => {
      if (err) {
        console.log(err);
      } else {
        if (doc[0] !== undefined) { //a document matching the username property has been found
          res.json("username already taken"); //view the original entry
        } else { //no match so proceed to add new docs
          savedUsers.push({username: newUser, _id: shortid.generate(), description: '', duration: 0, date: ''}); //populating the savedUsers array with objects for the newly added users
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
  } else res.json("username required");
});

app.post('/api/exercise/add', (req, res) => {
  const userId = req.body.userId;
  const details = req.body.description;
  const length = req.body.duration;
  const date = req.body.date;
  
  console.log(userId + ' ' + details + ' ' + length + ' ' + date);
  if (userId) {
    User.findByIdAndUpdate(userId, { description: details, duration: length, date: ( date ? new Date(date).toDateString() : new Date().toDateString())}, (err, doc) => {
      if (err) {
        console.log(err);
      } else {
        User.find({ username: doc.username }, '-__v', (err, updatedDoc) => {
          if (err) {
            console.log(err);
          } else {
            console.log(updatedDoc[0]);
            res.json(updatedDoc[0]); //view the entry with the updates applied
          }
        });
      }
    });
  } else res.json("unknown _id");
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
