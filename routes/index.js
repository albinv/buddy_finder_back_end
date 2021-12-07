var express = require('express');
var router = express.Router();
const MongoClient = require('mongodb').MongoClient;
const config = require('../config');
const schedule = require('node-schedule');
const  ObjectID  = require('mongodb').ObjectId;
var nodemailer = require('nodemailer');

// email: uol.studybuddyfinder@gmail.com
// pass:  studybuddyfinder591

// endpoint to get a list of all the students in the db
router.get('/all-students', (req, res, next) => {
  // get all records from DB by not providing a search filter
  req.collection.find({})
    .toArray()
    .then(results => res.json(results))
    .catch(error => res.send(error));
});

// endpoint to get a list of all the students in the db
router.get('/invoke-matching-process', (req, res, next) => {
  matchingProcess();
});

// Endpoint to add a new student
router.post('/add-student', (req, res, next) => {
  const {name, email, modules, date_registered } = req.body;
  // check if required fields are provided
  if (!name || !email || !modules || !date_registered) {
    return res.status(400).json({
      message: 'Required fields not provided'
    })
  } else {
    const payload = {name, email, modules, date_registered }
    // insert into DB
    req.collection.insertOne(payload)
      .then(result => res.json(result))
      .catch(error => res.send(error))
  }
});


var job = schedule.scheduleJob({hour: 00, minute: 00}, function(){
  matchingProcess();
});



async function matchingProcess() {
  // Get a list of all students currently in db
  let allStudents = await mogoDBCollection.find({}).toArray();

  // create a list containing pairs of students and how many modules they have in similar
  var similarityScoresList = [];
  var similarityScoresListOnlyScores = [];
  for(let student1 of allStudents){
    for (let student2 of allStudents){
      if(student1 != student2 && !checkIfStudentPairProcessed(similarityScoresList, student1, student2)){
        let simScore = checkModuleListSimilarity(student1.modules, student2.modules);
        similarityScoresList.push([student1._id, student2._id, simScore]);
        similarityScoresListOnlyScores.push(simScore);
      }
    }
  }

  // match the students who have the highest number of common modules and iterate until no more matches can be made
  let matchesList = [];
  let matchingFinished = false;
  while (!matchingFinished){
    if (similarityScoresList.length > 0) {
      let maxSimilarity = maxOfArray(similarityScoresListOnlyScores);
      let indexOfMaxSimilarity = similarityScoresListOnlyScores.indexOf(maxSimilarity);
      let matchedPair = similarityScoresList[indexOfMaxSimilarity];
      matchesList.push(matchedPair);
      similarityScoresList, similarityScoresListOnlyScores = removeMatchedStudentsFromArray(similarityScoresList, similarityScoresListOnlyScores, matchedPair[0], matchedPair[1]);
    } else {
      matchingFinished = true;
    }
  }

  // email the students who have been matched informing them of this and delete their records from the db
  for (let match of matchesList) {
    const student1 = await mogoDBCollection.find(match[0]).toArray();
    const student2 = await mogoDBCollection.find(match[1]).toArray();
    sendSuccessEmail(student1[0], student2[0], match[2]);
    sendSuccessEmail(student2[0], student1[0], match[2]);
    // if the email was not successfully sent then don't remove them from the db
    await mogoDBCollection.remove({ _id: match[0] });
    await mogoDBCollection.remove({ _id: match[1] });
  }

  // get an updated list of all students in the db after matching process has finished
  allStudents = await mogoDBCollection.find({}).toArray();

  // delete the students who have been in the db for more than a week and send them an email informing them of this
  for (let student of allStudents){
    console.log(student.date_registered)
    let date_registered_obj = student.date_registered.split("/");
    let date_registered = new Date(date_registered_obj[2], date_registered_obj[1]-1, date_registered_obj[0]);
    let date_expiry = addDays(date_registered, 7);
    let today = new Date();
    if(date_expiry <= today){
      sendMatchNotFoundEmail(student)
      await mogoDBCollection.remove({ _id: student._id });
    }
  }
}

function checkModuleListSimilarity(list1, list2) {
  console.log(list1);
  var similarityScore = 0;
  for(let module of list1) {
    if(list2.includes(module)){
      similarityScore++;
    }
  }
  return similarityScore;
}

function checkIfStudentPairProcessed(matched_list, student1, student2){
  for(let match of matched_list){
    if(match.includes(student1._id) || match.includes(student2._id)){
      return true
    }
  }
  return false;
}

function maxOfArray(array) {
  return Math.max.apply(Math, array);
}

function removeMatchedStudentsFromArray(arr1, arr2, student1, student2) {
  let arr1Tmp = arr1;
  let arr2Tmp = arr2;
  for(let i = 0; i < arr1.length; i++){
    if (arr1[i].includes(student1) || arr1[i].includes(student2)){
      arr1Tmp.splice(i,1);
      arr2Tmp.splice(i,1);
    }
  }
  return arr1Tmp, arr2Tmp;
}

function sendSuccessEmail(recipient, buddy, commonModulesNo){

var transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'uol.studybuddyfinder@gmail.com',
    pass: 'studybuddyfinder591'
  }
});

  let html_text = '<p> Hi ' + recipient.name + ',<p><br><br>' +
  '<h1>A new Study Buddy has been found for you, you share '+ commonModulesNo + ' modules together! <h1><br>' +
  '<p>Their name is: ' + buddy.name + ' and you can contact them via email: ' + buddy.email + '<p><br><br><br>' +
  '<p>Thanks for using this service<p><br><p>University of Liverpool<p>'
  
  var mailOptions = {
    from: 'uol.studybuddyfinder@gmail.com',
    to: recipient.email,
    subject: 'A Study Buddy Has been found for you!',
    html: html_text
  };

  transporter.sendMail(mailOptions, function(error, info){
    if (error) {
      console.log(error);
      return false;
    } else {
      console.log('Email sent: ' + info.response);
      return true
    }
  });
}

function sendMatchNotFoundEmail(student){
  var transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'uol.studybuddyfinder@gmail.com',
      pass: 'studybuddyfinder591'
    }
  });
  
    let html_text = '<p> Hi ' + student.name + ',<p><br><br>' +
    '<h1>Unfortuatly we weren\'t able to find you a study buddy at this time. Please register again tomorrow if you wish to use this service again<br>'+
    '<p>Thanks for using this service<p><br><p>University of Liverpool<p>'
    
    var mailOptions = {
      from: 'uol.studybuddyfinder@gmail.com',
      to: student.email,
      subject: 'No Study Buddies Found!',
      html: html_text
    };
  
    transporter.sendMail(mailOptions, function(error, info){
      if (error) {
        console.log(error);
        return false;
      } else {
        console.log('Email sent: ' + info.response);
        return true
      }
    });
}

function addDays(date, days) {
  var result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}


module.exports = router;
