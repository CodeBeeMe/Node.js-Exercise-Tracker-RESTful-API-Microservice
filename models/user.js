'use strict'

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const User = new Schema({
  username: String,
  _id: String,
  exercise: [{
    _id: String,
    description: String,
    duration: Number,
    date: String
  }]  
});

module.exports = mongoose.model('User', User);
