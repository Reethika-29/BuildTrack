const express = require('express');
const mongoose = require('mongoose');
const Contractor = require('./models/contractor');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/your-database-name', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// POST route to add contractor
app.post('/contractor/add', async (req, res) => {
    try {
        const { projectId, name, contact, costEstimate, fromDate, toDate } = req.body;
        
        const newContractor = new Contractor({
            projectId,
            name,
            contact,
            costEstimate,
            fromDate,
            toDate
        });

        await newContractor.save();
        res.status(201).json({ message: 'Contractor added successfully', contractor: newContractor });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error adding contractor' });
    }
});
