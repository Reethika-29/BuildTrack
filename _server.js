const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const path = require('path');
const ejs = require('ejs');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const fs = require('fs');
const app = express();
const PORT = 3000;
const saltRounds = 10;
const uri = "mongodb://127.0.0.1:27017/sample";
const sessionSecret = 'reethika'; // Replace with a strong, unique secret

app.use(cookieParser());
app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Set to true if using HTTPS
}));
app.use(express.static(path.join(__dirname, 'public')));
app.set('views', path.join(__dirname, 'public', 'views'));
app.set('view engine', 'ejs');
//app.use(express.json());

// app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
// Connect to MongoDB
mongoose.connect(uri, {
  serverSelectionTimeoutMS: 30000, // 30 seconds
})
  .then(() => console.log('MongoDB connected'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1); // Exit the process if connection fails
  });

// -----------------------------------------------SCHEMA----------------------------------------------------------------------
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  role: String,
  MD: String
});
const User = mongoose.model('User', userSchema);

//budget


//stages
const milestoneStageSchema = new mongoose.Schema({
  projectId: mongoose.Schema.Types.ObjectId,
  stages: [{
    stage: Number,
    name: String,
    estimated: {
      start: Date,
      end: Date
    },
    actual: {
      start: Date,
      end: Date
    }
  }]
});

const MilestoneStage = mongoose.model('MilestoneStage', milestoneStageSchema);


const projectSchema = new mongoose.Schema({
  title: String,
  manager: String,
  description: String,
  location: String,
  budget: Number,
  category: String,
  fromDate: Date,
  toDate: Date,
  MD: String,
  todos: [{ // New field for to-do items
    task: String,
    dueDate: Date,
    completed: { type: Boolean, default: false }
  }]
});
const Project = mongoose.model('Project', projectSchema);

const stageDetailsSchema = new mongoose.Schema({
  projectId: mongoose.Schema.Types.ObjectId, // Store the reference to the project
  stages: [{
    stage: Number,
    estimated: Number,
    spent: Number
  }]
});
const StageDetails = mongoose.model('StageDetails', stageDetailsSchema);

// const contractorSchema = new mongoose.Schema({
//   projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
//   name: String,
//   contact: String,
//   costEstimate: Number,
//   fromDate: Date,
//   toDate: Date
// });

// // Contractor Model
// const Contractor = mongoose.model('Contractor', contractorSchema);


// Define schema and model for resources
const resourceSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  totalAmount: { type: Number, default: 0 },  // Field to store total amount spent across all stages
  stages: [
    {
      stage: Number,
      totalStageAmount: { type: Number, default: 0 },  // Field to store total amount for each stage
      resources: [
        {
          resourceType: String,
          quantity: Number,
          unit: String,
          amount: Number
        }
      ]
    }
  ]
});

const Resource = mongoose.model('Resource', resourceSchema);


//----------------------------------------------------------------- Routes------------------------------------------------------------
//-----------------------LOGIN
app.get('/', (req, res) => {
  if (req.session.user) {
    const username = req.session.user.username;
    const role = req.session.user.role;
    const currentPage = 'home';
    res.render('home', { username, role, currentPage });
  } else {
    res.redirect('/login');
  }
});

app.use(express.static("images"));
app.use('/webcamjavascript', express.static(path.join(__dirname, 'webcamjavascript')));

//----------------------------CREATE PROJECT
app.get('/create_project', async (req, res) => {
  if (req.session.user) {
    try {
      // Use Mongoose to find the users with the role "Manager" and MD as the username
      const managerUsers = await User.find({ role: "Manager", MD: req.session.user.username }).exec();
      const role = req.session.user.role;
      const username = req.session.user.username;
      const currentPage = 'create_project';
      res.render('create_project', { managers: managerUsers, role, currentPage });
    } catch (error) {
      console.error('Error fetching managers:', error);
      res.status(500).send('Error: ' + error.message);
    }
  } else {
    res.redirect('/login'); // Redirect back to login if not authenticated
  }
});



app.get('/login', (req, res) => {
  if (req.session.user) {
    res.redirect('/');
  } else {
    res.render('login', { errorMessage: '' });
  }
});

app.get('/track', (req, res) => {
  if (req.session.user) {
    const username = req.session.user.username;
    const role = req.session.user.role;
    const currentPage = 'track';
    res.render('track', { username, role, currentPage });
  } else {
    res.redirect('/login');
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error(err);
      res.redirect('/login?error=Failed to logout');
    } else {
      res.redirect('/login');
    }
  });
});


//----------------------------VIEW PROJECTS
app.get('/projects', async (req, res) => {
  if (req.session.user) {
    try {
      const username = req.session.user.username;
      const role = req.session.user.role;
      const currentPage = 'view_projects';
      const projects = await Project.find({ MD: username }).exec();
      res.render('view_projects', { username, role, currentPage, projects });
    } catch (error) {
      console.error('Error fetching projects:', error);
      res.status(500).send('Error: ' + error.message);
    }
  } else {
    res.redirect('/login');
  }
});

//----------------------------CREATE_EDIT_PROJECT
app.get('/projects/:projectId/create_edit_project', async (req, res) => {
  const { projectId } = req.params; // Get the projectId from the URL
  try {
    // Fetch project details using projectId, but exclude 'todos' field
    const project = await Project.findById(projectId).select('-todos');

    const role = req.session.user.role; // Assuming role is stored in session
    const currentPage = 'home';

    res.render('create_edit_project', { role, currentPage, projectId, project }); // Pass project to EJS
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).send('Server Error');
  }
});

const methodOverride = require('method-override');
const { removeListener } = require('process');

// Middleware to support method override
app.use(methodOverride('_method'));

app.put('/projects/:projectId', async (req, res) => {
  const { projectId } = req.params; // Get the projectId from the URL
  const {
    title,
    manager,
    description,
    location,
    budget,
    category,
    fromDate,
    toDate,
    MD
  } = req.body; // Get the updated project details from the request body

  try {
    // Find the project by ID and update it with the new data
    await Project.findByIdAndUpdate(projectId, {
      title,
      manager,
      description,
      location,
      budget,
      category,
      fromDate,
      toDate,
      MD
    });
    // Redirect to a success page or back to the project details page after updating
    res.redirect('/projects');
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).send('Server Error');
  }
});




app.post('/projects/:id/edit', async (req, res) => {
  const { title, description, category, location } = req.body;
  await Project.findByIdAndUpdate(req.params.id, {
    title,
    description,
    category,
    location,
  });
  res.redirect('/projects');
});

//----------------------------REGISTER MANAGER
app.get('/register', async (req, res) => {
  try {
    const MDlist = await User.find({ role: "MD" }).exec();
    res.render('register', { errorMessage: '', MDlist });
  } catch (error) {
    console.error('Error fetching MD list:', error);
    res.status(500).send('Error: ' + error.message);
  }
});

app.get('/manager_projects', async (req, res) => {
  if (req.session.user) {
    try {
      const managerName = req.session.user.username;
      const projects = await Project.find({ manager: managerName }).exec();
      const currentPage = 'manager_projects';
      const role = req.session.user.role;
      res.render('manager_projects', { projects, currentPage, role });
    } catch (error) {
      console.error('Error fetching manager projects:', error);
      res.status(500).send('Error: ' + error.message);
    }
  } else {
    res.redirect('/login');
  }
});


//----------------------------EDIT PROJECTS(EDIT_PROJECT.EJS- MAIN DASHBOARD)
app.get('/projects/:id/edit', async (req, res) => {
  const projectId = req.params.id;
  if (req.session.user) {
    try {
      const role = req.session.user.role;
      const project = await Project.findById(projectId).exec();
      const currentPage = 'edit_project'; // Define currentPage here
      if (project) {
        res.render('edit_project', { project, currentPage, role });
      } else {
        res.status(404).send('Project not found');
      }
    } catch (error) {
      console.error('Error fetching project details:', error);
      res.status(500).send('Error: ' + error.message);
    }
  } else {
    res.redirect('/login');
  }
});

// LOGIN
app.post('/login', async (req, res) => {
  try {
    const username = req.body.username;
    const password = req.body.password;
    const user = await User.findOne({ username }).exec();
    if (user) {
      const match = await bcrypt.compare(password, user.password);
      if (match) {
        req.session.user = { username, role: user.role };
        res.redirect('/');
      } else {
        res.render('login', { errorMessage: 'Wrong Password' });
      }
    } else {
      res.render('login', { errorMessage: 'Wrong Username' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).send('Error: ' + error.message);
  }
});

// REGISTRATION
app.post('/registration', async (req, res) => {
  try {
    const salt = await bcrypt.genSalt(saltRounds);
    const hash = await bcrypt.hash(req.body.password, salt);
    const existingUser = await User.findOne({ username: req.body.username }).exec();
    if (existingUser) {
      res.render('register', { errorMessage: 'Username already taken' });
    } else {
      const newUser = new User({
        username: req.body.username,
        password: hash,
        role: 'Manager',
        MD: req.body.MD
      });
      await newUser.save();
      res.redirect('/login');
    }
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).send('Error: ' + err.message);
  }
});

// DELETE route for deleting a project by its ID
app.delete('/projects/:id', async (req, res) => {
  try {
    const projectId = req.params.id;
    const result = await Project.findByIdAndDelete(projectId);
    if (result) {
      res.status(200).send('Project deleted successfully');
    } else {
      res.status(404).send('Project not found');
    }
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).send('Error: ' + error.message);
  }
});
app.use(express.static(path.join(__dirname, 'public')));
app.use('/images', express.static('images'));

// Create Project
app.post('/create_project', async (req, res) => {
  try {
    const newProject = new Project({
      title: req.body.name,
      manager: req.body.manager,
      description: req.body.desc,
      location: req.body.loc,
      budget: req.body.budget,
      category: req.body.category,
      fromDate: req.body['from-date'],
      toDate: req.body['to-date'],
      MD: req.session.user.username
    });
    await newProject.save();
    res.redirect('/');
  } catch (err) {
    console.error('Error creating project:', err);
    res.status(500).send('Error: ' + err.message);
  }
});



//----------------------------TO-DO LIST
app.get('/todo/:projectId', async (req, res) => {
  const projectId = req.params.projectId;

  try {
    const currentPage = "to_do";
    const role = req.session.user.role;
    // Find the project and pass its todos to the template
    const project = await Project.findById(projectId);
    if (project) {
      res.render('to_do', { projectId, project, role, currentPage });
    }
    else {
      res.status(404).send('Project not found');

    }
  }

  catch (error) {
    console.error('Error fetching project details:', error);
    res.status(500).send('Error: ' + error.message);
  }
});


app.post('/todo/:projectId/add', async (req, res) => {
  const projectId = req.params.projectId;
  const { task, dueDate } = req.body; // Extract dueDate from the request body

  try {
    const project = await Project.findById(projectId);
    if (project) {
      project.todos.push({ task, dueDate }); // Include dueDate in the new task
      await project.save();
      res.redirect(`/todo/${projectId}`);
    } else {
      res.status(404).send('Project not found');
    }
  } catch (error) {
    console.error('Error adding to-do item:', error);
    res.status(500).send('Error: ' + error.message);
  }
});


// Route to delete a to-do item
app.post('/todo/:todoId/delete', async (req, res) => {
  const todoId = req.params.todoId;

  try {
    // Find the project that contains the to-do item
    const project = await Project.findOne({ 'todos._id': todoId });
    if (project) {
      // Remove the to-do item from the todos array
      project.todos.id(todoId).remove();
      await project.save();
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, message: 'To-do item not found' });
    }
  } catch (error) {
    console.error('Error deleting to-do item:', error);
    res.status(500).json({ success: false, message: 'Error deleting to-do item' });
  }
});

// Route to toggle completion of a to-do item
app.post('/todo/:todoId/complete', async (req, res) => {
  const todoId = req.params.todoId;

  try {
    // Find the project that contains the to-do item
    const project = await Project.findOne({ 'todos._id': todoId });
    if (project) {
      // Toggle the completed status of the to-do item
      const todo = project.todos.id(todoId);
      todo.completed = !todo.completed;
      await project.save();
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, message: 'To-do item not found' });
    }
  } catch (error) {
    console.error('Error toggling to-do completion:', error);
    res.status(500).json({ success: false, message: 'Error toggling to-do completion' });
  }
});
//------------------------------BUDGET_STAGE

const budgetStageSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Project'
  },
  stages: [{
    stage: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    estimatedBudget: {
      type: Number,
      required: false
    },
    totalStageAmount: {
      type: Number,
      required: false
    }
  }]
});

const BudgetStage = mongoose.model('BudgetStage', budgetStageSchema);
app.get('/budget_Stage/:projectId', async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const currentPage = "report";
    const role = req.session.user.role;
    const project = { id: projectId, name: 'Sample Project' };

    const items = await MilestoneStage.find({ projectId: projectId });
    const budgetStage = await BudgetStage.findOne({ projectId: projectId });
    console.log('Fetched Budget Stage:', budgetStage); // Debug log
    const contractors = await Contractor.find({ projectId: projectId });
    const resources = await Resource.findOne({ projectId: projectId }, 'stages.stage stages.totalStageAmount');

    const stageAmountMap = new Map();
    if (resources) {
      resources.stages.forEach(stage => {
        stageAmountMap.set(stage.stage, stage.totalStageAmount);
      });
    }

    const estimatedBudgetMap = new Map();
    if (budgetStage && budgetStage.stages) {
      budgetStage.stages.forEach(stage => {
        estimatedBudgetMap.set(stage.stage, stage.estimatedBudget);
      });
    }

    res.render('budget_Stage', {
      items: items,
      contractors: contractors,
      resources: resources,
      stageAmountMap: stageAmountMap,
      estimatedBudgetMap: estimatedBudgetMap,
      currentPage: currentPage,
      role: role,
      project: project
    });
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/submit-budget/', async (req, res) => {
  try {
    const { projectId, editedBudgets } = req.body; // Get projectId and edited budgets from request body

    // Parse the edited budgets string back to an object
    const estimatedBudgets = JSON.parse(editedBudgets);

    // Check if a budget stage already exists for the project
    let budgetStage = await BudgetStage.findOne({ projectId: projectId });

    if (budgetStage) {
      // Update existing budget stage
      budgetStage.stages = Object.keys(estimatedBudgets).map(stage => ({
        stage: stage,
        name: stage, // Adjust this if you want to capture a specific name differently
        estimatedBudget: Number(estimatedBudgets[stage]), // Convert to number
        totalStageAmount: budgetStage.stages.find(s => s.stage === stage)?.totalStageAmount || 0 // Retain existing totalStageAmount
      }));
      console.log('Edited Budgets:', editedBudgets);
      console.log('Received Project ID:', projectId);
      console.log('Edited Budgets:', estimatedBudgets);


      await budgetStage.save(); // Save the updated budget stage
    } else {
      // Create a new BudgetStage object
      const budgetStageData = {
        projectId: projectId,
        stages: Object.keys(estimatedBudgets).map(stage => ({
          stage: stage,
          name: stage, // Adjust this if you want to capture a specific name differently
          estimatedBudget: Number(estimatedBudgets[stage]), // Convert to number
          totalStageAmount: 0 // Set to 0 or calculate if necessary
        }))
      };

      // Save the new BudgetStage to the database
      budgetStage = new BudgetStage(budgetStageData);
      await budgetStage.save();
    }

    res.redirect(`/budget_Stage/${projectId}`); // Redirect after saving
  } catch (error) {
    console.error('Error submitting budget stage:', error);
    res.status(500).send('Internal Server Error');
  }
});


//----------------------------MILESTONE
app.get('/milestone/:projectId', (req, res) => {
  const projectId = req.params.projectId;
  const project = { id: projectId, name: 'Sample Project' }; // Placeholder data
  const currentPage = "milestone";
  const role = req.session.user.role;

  res.render('milestone', { project, role, currentPage });
});

app.get('/milestones/:projectId', async (req, res) => {
  try {
    const projectId = req.params.projectId;

    // Validate projectId
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      console.error('Invalid projectId:', projectId);
      return res.status(400).json({ success: false, message: 'Invalid projectId' });
    }

    // // Fetch the MilestoneStage document based on projectId
    const milestoneStage = await MilestoneStage.findOne({ projectId: new mongoose.Types.ObjectId(projectId) });
    if (!milestoneStage) {
      return res.status(404).json({ success: false, message: 'MilestoneStage not found' });
    }

    res.json({ success: true, milestoneStage });
  } catch (error) {
    console.error('Error fetching milestone details:', error);
    res.status(500).json({ success: false, message: 'Error fetching milestone details' });
  }
});
app.post('/milestone', async (req, res) => {
  try {
    const { stages, projectId } = req.body;

    // Validate projectId
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      console.error('Invalid projectId:', projectId);
      return res.status(400).json({ success: false, message: 'Invalid projectId' });
    }

    // Find the existing milestone document to get the count of stages
    const milestoneStage = await MilestoneStage.findOne({ projectId: new mongoose.Types.ObjectId(projectId) });

    // Determine the starting stage number
    const existingStageCount = milestoneStage ? milestoneStage.stages.length : 0;

    // Map the new stages with correct stage numbering
    const newStages = stages.map((stage, index) => ({
      stage: existingStageCount + index + 1, // Adjust stage number based on existing stages
      name: stage.name,
      estimated: {
        start: stage.estimatedStart,
        end: stage.estimatedEnd
      },
      actual: {
        start: stage.actualStart || null,
        end: stage.actualEnd || null
      }
    }));

    // Update or create the milestone document with new stages
    const updatedMilestoneStage = await MilestoneStage.findOneAndUpdate(
      { projectId: new mongoose.Types.ObjectId(projectId) },
      {
        $push: { stages: { $each: newStages } } // Append new stages
      },
      { new: true, upsert: true } // Create a new document if none exists
    );

    res.redirect(`/milestone/${projectId}`);
  } catch (error) {
    console.error('Error saving milestone details:', error);
    res.status(500).json({ success: false, message: 'Error saving milestone details' });
  }
});


// Update existing stage data
app.put('/milestone/:stageId', async (req, res) => {
  try {
    const { stageId } = req.params;
    const { name, estimatedStart, estimatedEnd, actualStart, actualEnd } = req.body;

    // Find the milestone stage and update it
    const updatedStage = await MilestoneStage.updateOne(
      { 'stages._id': stageId },
      {
        $set: {
          'stages.$.name': name,
          'stages.$.estimated.start': estimatedStart,
          'stages.$.estimated.end': estimatedEnd,
          'stages.$.actual.start': actualStart || null,
          'stages.$.actual.end': actualEnd || null
        }
      }
    );

    if (updatedStage.nModified === 0) {
      return res.status(404).json({ success: false, message: 'Stage not found or no changes made' });
    }

    res.json({ success: true, message: 'Stage updated successfully' });
  } catch (error) {
    console.error('Error updating milestone stage:', error);
    res.status(500).json({ success: false, message: 'Error updating milestone stage' });
  }
});
app.delete('/milestone/:stageId', async (req, res) => {
  try {
    const { stageId } = req.params;

    // Validate stageId
    if (!mongoose.Types.ObjectId.isValid(stageId)) {
      console.error('Invalid stageId:', stageId);
      return res.status(400).json({ success: false, message: 'Invalid stageId' });
    }

    // Find and remove the stage
    const milestoneStage = await MilestoneStage.findOneAndUpdate(
      { 'stages._id': stageId },
      { $pull: { stages: { _id: stageId } } },
      { new: true }
    );

    if (!milestoneStage) {
      return res.status(404).json({ success: false, message: 'Stage not found' });
    }

    res.json({ success: true, message: 'Stage deleted successfully' });
  } catch (error) {
    console.error('Error deleting milestone stage:', error);
    res.status(500).json({ success: false, message: 'Error deleting milestone stage' });
  }
});





//----------------------------RESOURCES

app.get('/resource/:projectId', async (req, res) => {
  const projectId = req.params.projectId;
  const projectTitle = req.params.title;
  const project = { id: projectId, name: projectTitle }; // Replace with actual project data if needed
  const currentPage = "resource";
  const role = req.session.user.role;

  try {
    // Fetch existing resources for the project
    const resourceData = await Resource.findOne({ projectId });
    const milestoneData = await MilestoneStage.findOne({ projectId });

    // If there are no resources, set stages to an empty array
    const stages = resourceData ? resourceData.stages : [];
    const milestoneStages = milestoneData ? milestoneData.stages : []; // Fetch milestone stages
    console.log("---------------------------------------")
    console.log("STAGESSSS",stages,milestoneStages)
    // Map the milestone stages to only get the name and stage number
    const stageDetails = milestoneStages.map(stage => ({
      stage: stage.stage,
      name: stage.name
    }));
    console.log("DETAILSSSSSS",stageDetails)
    res.render('resource', { project, stages, stageDetails, role, currentPage });
  } catch (err) {
    console.error('Error fetching resources:', err);
    res.status(500).send('Error: ' + err.message);
  }
});


app.post('/add_resource', async (req, res) => {
  try {
    console.log(req.body)
    const { projectId, stageCount } = req.body;
    const stages = [];
    let totalAmount = 0;  // To keep track of the total amount spent

    const numStages = parseInt(stageCount, 10);  // Parse the stage count as a number

    // Loop through each stage and gather resources
    for (let i = 1; i <= numStages; i++) {
      const resourceTypes = req.body[`resourceType-${i}`] || [];
      const quantities = req.body[`quantity-${i}`] || [];
      const units = req.body[`unit-${i}`] || [];  // Extract the unit for each resource
      const amounts = req.body[`amount-${i}`] || [];

      let totalStageAmount = 0;  // To keep track of the total amount for the current stage

      // Process the resources in the current stage
      const stageResources = resourceTypes.map((resourceType, index) => {
        const amount = parseFloat(amounts[index]) || 0;
        totalStageAmount += amount;  // Add the resource amount to the stage total
        return {
          resourceType,
          quantity: quantities[index] || '0',  // Default quantity to '0' if not provided
          unit: units[index] || '',  // Default unit to empty string if not provided
          amount
        };
      });

      // Add the stage total to the overall total
      totalAmount += totalStageAmount;

      // Push the stage data, including totalStageAmount
      stages.push({ stage: i, totalStageAmount, resources: stageResources });
    }

    // Check if the project already has resources saved
    const existingResource = await Resource.findOne({ projectId });

    if (existingResource) {
      // Update existing resources
      existingResource.stages = stages;
      existingResource.totalAmount = totalAmount;  // Update total amount spent across all stages
      await existingResource.save();
    } else {
      // Create new resource entry
      const newResource = new Resource({
        projectId,
        stages,
        totalAmount  // Save total amount spent
      });
      await newResource.save();
    }

    res.redirect(`/resource/${projectId}`);
  } catch (err) {
    console.error('Error adding resource:', err);
    res.status(500).send('Error: ' + err.message);
  }
});


// app.post('/save_resource', async(req,res)=>{
//   const {body} = req.body
//   console.log(body)
//   res.json({ message: 'Resource saved successfully!', data: body });

// })

// app.put('/update_resource/:stage/:resource_id', async (req,res)=>{
//   const {stage,id} = req.params
//   const {body} = req.body


// })
app.delete('/delete_stage/:stageNumber', async (req, res) => {
  const projectId = req.query.projectId; // Fetch projectId from query parameters
  const stageNumber = parseInt(req.params.stageNumber, 10); // Parse stage number from URL parameters

  try {
    const resource = await Resource.findOne({ projectId });

    if (!resource) {
      return res.status(404).send('Resource not found.');
    }

    // Check if the stage exists
    const stageExists = resource.stages.some(stage => stage.stage === stageNumber);
    if (!stageExists) {
      return res.status(404).send('Stage not found.');
    }

    resource.stages = resource.stages.filter(stage => stage.stage !== stageNumber);

    // Recalculate total amount
    resource.totalAmount = resource.stages.reduce((total, stage) => {
      return total + stage.resources.reduce((stageTotal, resource) => {
        return stageTotal + resource.amount;
      }, 0);
    }, 0);

    await resource.save();

    res.status(200).send(`Stage ${stageNumber} deleted successfully.`);
  } catch (err) {
    console.error('Error deleting stage:', err);
    res.status(500).send({ message: 'Error deleting stage', error: err.message });
  }
});

app.delete('/delete_resource/:stageNumber', async (req, res) => {
  try {
    const { stageNumber } = req.params;
    const projectId = req.query.projectId; // Assuming projectId is passed in the query
    const resourceType = req.body.resourceType; // Assuming resourceType is passed in the body

    // Find the project resource by projectId
    const project = await Resource.findOne({ projectId: projectId });
    if (!project) {
      return res.status(404).send('Project not found');
    }

    // Find the stage by stageNumber
    const stage = project.stages.find(s => s.stage === parseInt(stageNumber));
    if (!stage) {
      return res.status(404).send('Stage not found');
    }

    // Find the resource by resourceType
    const resourceIndex = stage.resources.findIndex(r => r.resourceType === resourceType);
    if (resourceIndex === -1) {
      return res.status(404).send('Resource not found');
    }

    // Remove the resource
    stage.resources.splice(resourceIndex, 1);

    // Optionally update the totalStageAmount after resource removal
    stage.totalStageAmount = stage.resources.reduce((sum, resource) => sum + resource.amount, 0);

    // Save the changes to the database
    await project.save();

    // Send success response
    res.status(200).send('Resource deleted successfully');
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});


//----------------------------CCTV
app.get('/test/:projectId', (req, res) => {
  const projectId = req.params.projectId;
  const project = { id: projectId, name: 'Sample Project' }; // Placeholder data

  res.render('test', { project });
});
app.use('/webcamjavascript', express.static(path.join(__dirname, 'webcamjavascript')));



//----------------------------UPLOAD DOCUMENT

// Define the Document schema
const documentSchema = new mongoose.Schema({
  filename: String,
  originalName: String,
  path: String,
  createdAt: { type: Date, default: Date.now },
  projectId: { type: String, required: true }, // Field to store project ID
});

const Document = mongoose.model('Document', documentSchema);
app.use('/documents', express.static('documents'));
// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = './documents'; // Change to documents folder
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir); // Create documents folder if it doesn't exist
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)); // Append timestamp to file name
  },
});

const upload = multer({ storage });

// Middleware to serve static files
app.use(express.static('documents'));
app.use(express.urlencoded({ extended: true }));



// Route to render the upload page and fetch existing documents
app.get('/upload/:projectId', async (req, res) => {
  const projectId = req.params.projectId;
  const currentPage = "docs";
  const role = req.session.user.role;
  const project = { id: projectId, name: 'Sample Project' }; // Placeholder data

  try {
    const documents = await Document.find({ projectId }); // Fetch documents for the project
    res.render('upload', { project, documents, role, currentPage }); // Pass documents to the EJS template
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).send({ message: 'Error fetching documents', error });
  }
});

// Route to upload a new document
app.post('/upload', upload.single('document'), async (req, res) => {
  const userFilename = req.body.filename;
  const fileExtension = path.extname(req.file.originalname);

  const newFilePath = path.join('./documents', userFilename + fileExtension);
  // Get a unique file path if needed (optional)
  const uniqueFilePath = await getUniqueFilePath('./documents', userFilename + fileExtension);

  fs.rename(req.file.path, uniqueFilePath, async (err) => {
    if (err) {
      return res.status(500).send('Error renaming file');
    }

    const document = new Document({
      filename: userFilename + fileExtension,
      originalName: req.file.originalname,
      path: uniqueFilePath,
      projectId: req.body.projectId,
    });

    await document.save();
    res.redirect(`/upload/${req.body.projectId}`); // Redirect back to the upload page
  });
});

// Function to ensure unique file names
async function getUniqueFilePath(dir, filename) {
  let uniquePath = path.join(dir, filename);
  let counter = 1;

  while (fs.existsSync(uniquePath)) {
    const ext = path.extname(filename);
    const base = path.basename(filename, ext);
    uniquePath = path.join(dir, `${base} (${counter})${ext}`);
    counter++;
  }

  return uniquePath;
}

// Route to delete a document by ID
app.delete('/api/documents/:documentId', async (req, res) => {
  try {
    const document = await Document.findByIdAndDelete(req.params.documentId);

    if (!document) {
      return res.status(404).send({ message: 'Document not found' });
    }

    // Remove the file from the filesystem
    fs.unlink(document.path, (err) => {
      if (err) console.error('Error deleting file:', err);
      else console.log(`File ${document.filename} deleted successfully.`);
    });

    res.status(204).send(); // No content response after deletion
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).send({ message: 'Error deleting document', error });
  }
});


//----------------------------CONTRACTOR


const contractorSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  name: String,
  contact: String,
  costEstimate: Number,
  fromDate: Date,
  toDate: Date
});

// Create a model for Contractor
const Contractor = mongoose.model('Contractor', contractorSchema);

// Route to fetch and render contractors for a specific project
app.get('/contractor/:projectId', async (req, res) => {
  const { projectId } = req.params;
  const currentPage = "milestone";
  const role = req.session.user.role;

  try {
    const contractors = await Contractor.find({ projectId });
    res.render('contractor', { project: { id: projectId }, role, currentPage, contractors });
  } catch (error) {
    console.error('Error fetching contractors:', error);
    res.status(500).json({ message: 'Error fetching contractors' });
  }
});

// POST Route to Add Contractor
// Route to add a new contractor
app.post('/contractor/add', async (req, res) => {
  const { projectId, name, contact, costEstimate, fromDate, toDate } = req.body;

  try {
    const newContractor = new Contractor({
      projectId,
      name,
      contact,
      costEstimate,
      fromDate,
      toDate
    });

    await newContractor.save();
    res.json({ message: 'Contractor added successfully' });
  } catch (error) {
    console.error('Error adding contractor:', error);
    res.status(500).json({ message: 'Error adding contractor' });
  }
});

// Route to update a specific contractor
app.put('/contractors/update/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const updatedData = req.body; // Assuming body contains updated fields
    await Contractor.findByIdAndUpdate(id, updatedData);

    res.json({ message: 'Contract updated successfully' });
  } catch (error) {
    console.error('Error updating contractor:', error);
    res.status(500).json({ message: 'Error updating contractor' });
  }
});

// Route to delete a specific contractor
app.delete('/contractors/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await Contractor.findByIdAndDelete(id);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting contractor:', error);
    res.status(500).json({ success: false });
  }
});
//--------------------------------------PHOTO



const photoSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, required: true },
  filename: { type: String, required: true },
  title: { type: String, required: true },
  stage: { type: String },
  uploadedAt: { type: Date, default: Date.now }
});

const Photo = mongoose.model('Photo', photoSchema);

module.exports = Photo;


// Ensure the uploads directory exists
const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Multer configuration for file uploads
const storage1 = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Directory to store the files
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Unique filename
  }
});

const uploadphoto = multer({ storage: storage1 });



// Middleware to serve static files from the uploads directory
app.use('/uploads', express.static('uploads'));

// Body parser middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// MongoDB connection (adjust connection string as needed)
mongoose.connect('mongodb://localhost/photoapp', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));



// Endpoint to fetch photos by projectId
app.get('/photos/:projectId', async (req, res) => {
  const projectId = req.params.projectId;
  const currentPage = "photos"; // Current page
  const role = req.session?.user?.role || "MD"; // Use session role if available

  try {
    const photos = await Photo.find({ projectId });
    const milestones = await MilestoneStage.findOne({ projectId });
    const stages = milestones ? milestones.stages : [];

    res.render('photos', { photos, stages, projectId, role, currentPage }); // Render photos.ejs template
  } catch (error) {
    console.error('Error fetching photos:', error);
    res.status(500).send({ message: 'Error fetching photos', error });
  }
});

// Endpoint to handle photo uploads
app.post('/api/photos/:projectId', uploadphoto.single('photo'), async (req, res) => {
  const projectId = req.params.projectId;
  console.log(req.file); // Log to check if file is being uploaded
  console.log(req.body); // Log to check if title is being uploaded
  if (!req.file) {
    return res.status(400).send({ message: 'File not uploaded properly' });
  }
  try {
    const newPhoto = new Photo({
      projectId,
      filename: req.file.filename, // Filename saved by multer
      title: req.body.title,
      stage: req.body.stage
    });

    await newPhoto.save();
    res.status(201).send(newPhoto); // Success response
  } catch (error) {
    console.error('Error saving photo:', error);
    res.status(500).send({ message: 'Error saving photo', error });
  }
});

// Endpoint to delete photos by projectId and photoId
app.delete('/api/photos/:projectId/:photoId', async (req, res) => {
  const { projectId, photoId } = req.params;

  try {
    const photo = await Photo.findByIdAndDelete(photoId);

    if (!photo) {
      return res.status(404).send({ message: 'Photo not found' });
    }

    // Delete the file from the filesystem
    fs.unlink(`uploads/${photo.filename}`, (err) => {
      if (err) console.error('Error deleting file:', err);
      else console.log(`File ${photo.filename} deleted successfully.`);
    });

    res.status(204).send(); // Success response, no content
  } catch (error) {
    console.error('Error deleting photo:', error);
    res.status(500).send({ message: 'Error deleting photo', error });
  }
});


//------------------------------HUMAN RESOURCE
const hrSchema = new mongoose.Schema({
  name: String,
  designation: String,
  salary: Number,
  fromDate: Date,
  toDate: Date,
  projectId: {
    type: mongoose.Schema.Types.ObjectId, // Reference the Project model
    ref: 'Project',
    required: true
  }
});

// Create a model for Human Resource
const HR = mongoose.model('HR', hrSchema);


app.get('/human/:projectId', async (req, res) => {
  const projectId = req.params.projectId;
  const currentPage = "human resource"; // Current page
  const role = req.session.user.role; // User role from session
  const project = { id: projectId, name: 'Sample Project' }; // Placeholder data


  try {
    // Fetch HR entries for the specific project
    const hrEntries = await HR.find({ projectId }); // Assuming HR is your model
    res.render('human', { project, hrEntries, role, currentPage }); // Pass hrEntries to the template
  } catch (error) {
    console.error('Error fetching HR entries:', error);
    res.status(500).send('Error fetching HR entries');
  }
});

app.post('/add_hr', (req, res) => {
  const { name, designation, salary, fromDate, toDate, projectId } = req.body;

  // Create a new HR entry
  const newHR = new HR({
    name,
    designation,
    salary,
    fromDate,
    toDate,
    projectId // Associate the HR entry with the project
  });

  // Save the HR entry to MongoDB
  newHR.save()
    .then(() => {
      console.log('Human Resource added successfully');
      res.redirect(`/human/${projectId}`); // Redirect to the same project page
    })
    .catch(err => {
      console.error('Error saving HR data:', err);
      res.status(500).send('Error saving data');
    });
});

app.post('/update_hr/:id', async (req, res) => {
  const { name, designation, salary, fromDate, toDate } = req.body;

  try {
    await HR.findByIdAndUpdate(req.params.id, { name, designation, salary, fromDate, toDate });
    console.log('Human Resource updated successfully');
    res.redirect(`/human/${req.body.projectId}`); // Redirect back to project page
  } catch (error) {
    console.error('Error updating HR data:', error);
    res.status(500).send('Error updating data');
  }
});
app.delete('/hr/:id', async (req, res) => {
  try {
    const result = await HR.findByIdAndDelete(req.params.id);
    if (!result) {
      return res.status(404).json({ success: false, message: 'Resource not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting resource:', error);
    res.status(500).json({ success: false, message: 'Error deleting resource' });
  }
});
//---------------------------------REPORT


app.get('/report/:projectId', async (req, res) => {
  try {
    const projectId = req.params.projectId; // Get the projectId from the route parameters
    const currentPage = "report"; // Current page
    const role = req.session.user.role; // User role from session

    // Fetch only items related to the specific projectId
    const items = await MilestoneStage.find({ projectId: projectId }); // Filter by projectId
    const contractors = await Contractor.find({ projectId: projectId });
    const resources = await Resource.find({ projectId: projectId });
    const projects = await Project.find({ _id: projectId });
    const hrSchema = await HR.find({ projectId: projectId });
    // Render report.ejs with the fetched items
    res.render('report', { projects: projects, items: items, contractors: contractors, resources: resources, hrSchema: hrSchema, currentPage: currentPage, role: role });
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).send('Internal Server Error');
  }
});

//---------------------------------LISTENING TO PORT
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
