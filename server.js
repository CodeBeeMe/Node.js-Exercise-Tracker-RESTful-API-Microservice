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
let err;

const userSchema = new mongoose.Schema({
  username: String,
  _id: String,
  exercise: [{
    _id: String,
    description: String,
    duration: Number,
    date: String
  }]  
});

const User = mongoose.model('User', userSchema);

//==============================User Story #1==============================
//adding a new user in the DB
app.post('/api/exercise/new-user', (req, res, next) => {
  const newUser = req.body.username;  
  const validUser = (/^.{2,15}$/i).test(newUser);//testing to see if the entered username matches the defined regExp
  
  console.log(newUser);
  
  if(validUser) {
    User.find({ username: newUser }, '-__v', (err, doc) => {
      if (err) {
        console.log(err);
      } else {
        if (doc[0] !== undefined) { //a document matching the username property has been found
          err = new Error("Conflict: username already taken"); //error message
          err.status = 409;
          return next(err);
        } else { //no match so proceed to add new docs
          savedUsers.push({ username: newUser, _id: shortid.generate(), exercise: [] }); //populating the savedUsers array with objects for the newly added users
          res.json({ username: savedUsers[0].username, _id: savedUsers[0]._id });
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
  } else {
    err = new Error("Error: invalid username"); //error message
    err.status = 401;
    return next(err);
  }
});

//==============================User Story #2==============================
//getting an array with all the users, showing only the _id and username properties
app.get('/api/exercise/users', (req, res) => {
  //get an array with all the users in the DB"
  User
    .find({})
    .select('-exercise -__v')
    .exec((err, doc) => {
    err ? console.log(err) : res.json(doc);
    console.log(doc);
  });
});

//==============================User Story #3==============================
//finding the user by his _id and then adding an exercise entry in his schedule
app.post('/api/exercise/add', (req, res, next) => {
  const userId = req.body.userId;
  const details = req.body.description;
  const length = req.body.duration;
  let date = req.body.date;
  
  date ? date = new Date(date).toDateString() : date = new Date().toDateString(); // if the date field is empty to add today's date as default
  
  console.log(userId + ' ' + details + ' ' + length + ' ' + date);
  
  //form validation: *userId*, description* and *duration* fields need to be filled - they are required in succession
  if (!userId) {
    err = new Error("Error: invalid _id");
    err.status = 401;
    return next(err);
  } else {
    if (!details) {
      err = new Error('Path `description` is required');
      return next(err);
    } else {
      if (!length) {
        err = new Error('Path `duration` is required');
        return next(err);
      } else {
        if (isNaN(length)) {
          err = new Error('Error: `duration` needs to be a number');
          err.status = 401;
          return next(err);
        } else {
          //proceeding to find the user by _id and then update its properties after pushing a new entry in the exercise array
          User.findByIdAndUpdate(userId, {
            $push: { exercise: [{
              _id: shortid.generate(),
              description: details,
              duration: length,
              date: date 
            }]}}, (err, doc) => {
            if (err) {
              console.log(err);
            } else {
              if(doc) { //user is found by _id
                //proceeding to get the updated exercise entry from the user's document
                User.find({ username: doc.username }, '-__v', (err, updatedDoc) => {
                  let last = updatedDoc[0].exercise.length - 1; //index of the last entry
                  if (err) {
                    console.log(err);
                  } else {
                    console.log(updatedDoc[0]);
                    //view the last entry
                    res.json({
                      _id: updatedDoc[0]._id,
                      username: updatedDoc[0].username, 
                      description: updatedDoc[0].exercise[last].description, 
                      duration: updatedDoc[0].exercise[last].duration, 
                      date: updatedDoc[0].exercise[last].date
                    });
                  }
                });
              } else { //user _id not found
                err = new Error('_id: ' + userId + ' - Not Found' );
                err.status = 404;
                return next(err);
              }
            }
          });
        }
      }
    }
  }
});

//==============================User Story #4==============================
//get the user's document with a log for total exercises added and total exercise count
app.get('/api/exercise/log/:_id?', (req, res, next) => {
  const userId = req.params._id;
  if (userId) {
    User
    .findById(userId)
    .select('-__v')
    .exec((err, doc) => {
      err ? console.log(err) : null;
      if (doc) {//_id found
        res.json({ User_document: doc, Total_exercise_count: doc.exercise.length });
        console.log(doc);
      } else { //_id not found
        err = new Error('_id: ' + userId + ' - Not Found' );
        err.status = 404;
        return next(err);
      }
    });
  } else { //_id is undefined because it was not entered as a parameter
    err = new Error('_id: ' + userId);
    err.status = 404;
    return next(err);
  }
});

//==============================User Story #5==============================
//get user's document with a partial log of the exercises added, passing options from and to a date
/*app.get('/api/exercise/log', (req, res) => {
  const userId = req.query._id;
  const num = req.query.limit;
    
  console.log(userId);
  console.log(num);
  
  User
    .findById(userId)
    .sort('-date')
    .limit(Number(num))
    .select('-__v')
    .exec((err, doc) => {
    err ? console.log(err) : res.json({User_document: doc, Total_exercise_count: doc.exercise.length});
    console.log(doc);
  });
});*/


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
