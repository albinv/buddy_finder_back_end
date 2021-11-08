var express = require('express');
var router = express.Router();
const  ObjectID  = require('mongodb').ObjectId;

// endpoint to get a list of all the students in the db
router.get('/all-students', (req, res, next) => {
  // get all records from DB by not providing a search filter
  req.collection.find({})
    .toArray()
    .then(results => res.json(results))
    .catch(error => res.send(error));
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



module.exports = router;
