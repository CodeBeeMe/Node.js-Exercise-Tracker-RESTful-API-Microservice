const User = require('../models/user');
const router = require('express').Router();
const shortid = require('shortid');

//====================================================================================

let savedUsers = [];
let err, interval;

//====================================User Story #1====================================
//adding a new user in the DB
router.post('/new-user', (req, res, next) => {
  const newUser = req.body.username;  
  const validUser = (/^.{2,15}$/i).test(newUser);//testing to see if the entered username matches the defined regExp
  
  console.log(newUser);
  
  if(validUser) {
    User.find({ username: newUser }, '-__v', (err, doc) => {
      if (err) {
        return next(err);
      } else {
        if (doc[0] !== undefined) { //a document matching the username property has been found
          err = new Error("Conflict: username already taken"); //error message
          err.status = 409;
          return next(err);
        } else { //no match so proceed to add new docs
          savedUsers.push({
            username: newUser,
            _id: shortid.generate(),
            exercise: []
          }); //populating the savedUsers array with objects for the newly added users
          res.json({
            username: savedUsers[0].username,
            _id: savedUsers[0]._id
          });
          //saving all objects from the savedUsers array as documents in the DB
          User.create(savedUsers,  (err, users) => {
            err ? next(err) : console.log(users);
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

//====================================User Story #2====================================
//getting an array with all the users, showing only the _id and username properties
router.get('/users', (req, res, next) => {
  //get an array with all the users in the DB"
  User
    .find({})
    .select('-exercise -__v')
    .exec((err, doc) => {
    err ? next(err) : res.json(doc);
    console.log(doc);
  });
});

//====================================User Story #3====================================
//finding the user by his _id and then adding an exercise entry in his schedule
router.post('/add', (req, res, next) => {
  const userId = req.body.userId;
  const description = req.body.description;
  const duration = req.body.duration;
  let date = req.body.date;
  
  date ? date = new Date(date).toDateString() : date = new Date().toDateString(); // if the date field is empty to add today's date as default
  //console.log(userId + ' ' + description + ' ' + duration + ' ' + date);
  
  //form validation: *userId*, description* and *duration* fields need to be filled - they are required in succession  
  if (!userId) {
    err = new Error("Error: invalid _id");
    err.status = 401;
    return next(err);
  } else {
    if (!description) {
      return next(new Error('Path `description` is required'));
    } else {      
      if (!duration) {
        return next(new Error('Path `duration` is required'));
      } else {        
        if (isNaN(duration)) {
          err = new Error('Error: `duration` needs to be a number');
          err.status = 401;
          return next(err);
        } else {
          if(description.length > 20) return next(new Error('`description` too long - MAX: 20 charcters'));
          else
            if(duration < 1) return next(new Error('`duration` too short - MIN: 1 min'));
          else {
            if (isNaN(Date.parse(date))) return next(new Error('Path `data` must use format yyyy-mm-dd or be empty for today\'s date')); //check if it's not a date format
            else {
              //proceeding to find the user by _id and then update its properties after pushing a new entry in the exercise array
              User.findByIdAndUpdate(userId, {
                $push: { exercise: [{
                  _id: shortid.generate(),
                  description: description,
                  duration: duration,
                  date: date
                }]}}, (err, user) => {
                if (err) {
                  return next(err);
                } else {
                  if(user) { //user is found by _id
                    //proceeding to get the updated exercise entry from the user's document
                    User.find({ username: user.username }, '-__v', (err, updatedDoc) => {
                      let last = updatedDoc[0].exercise.length - 1; //index of the last entry
                      if (err) {
                        return next(err);
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
    }
  }
});


//====================================User Story #4 & #5====================================
//get user's document with a customisable control over results
//viewing a partial or complete log of the exercises added, passing options *from*, *to* a date and *limit* number of exercises viewed
router.get('/log', (req, res, next) => {
  const userId = req.query.userId;
  const from = new Date(req.query.from);
  const to = new Date(req.query.to);
  const limit = Number(req.query.limit);
    
  //first step is finding the user based on the userId
  User.findById(userId, '-__v', (err, user) => {
      if (err) return next(err);
      else {
        if (user) { //a user matching the _id has been found
          //console.log(user);
          //filtering the results based on the applied optional conditions
          if (from != "Invalid Date" && to != "Invalid Date") { //both *from* and *to* are present and are valid
            interval = user.exercise.filter((entry) => Date.parse(entry.date) < to.getTime() && Date.parse(entry.date) > from.getTime());
          } else {//the rest of the combinations when one or the other is missing
            if (from != "Invalid Date" && to == "Invalid Date")//*from* is applied and *to* is missing 
              interval = user.exercise.filter((entry) => Date.parse(entry.date) > from.getTime());
            else if (from == "Invalid Date" && to != "Invalid Date")//*to* is applied and *from* is missing 
              interval = user.exercise.filter((entry) => Date.parse(entry.date) < to.getTime());
            else
              interval = user.exercise; //in case all options are missing
          }
          
          res.json({//viewing the result of the query
            _id: user._id,
            username: user.username,
            from: from != "Invalid Date" ? from.toDateString() : undefined,
            to: to != "Invalid Date" ? to.toDateString() : undefined,
            count: limit ? interval.slice(0, limit).length : interval.length,
            log: limit ? interval.slice(0, limit) : interval
          });
        } else {          
          err = new Error('_id: ' + userId + ' - Not Found' );
          err.status = 404;
          return next(err);
        }
      }
  });
});

module.exports = router

//===============================================
