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
const uri = "mongodb://127.0.0.1:27017/sample"; // Replace with your connection string
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

const budgetStageSchema = new mongoose.Schema({
  projectId: mongoose.Schema.Types.ObjectId,
  stages: [
      {
          stage: { type: Number, required: true },
          estimatedAmount: { type: Number, required: true }
      }
  ],
  totalEstimatedAmount: { type: Number, required: true } // New field for total estimated amount
});

const BudgetStage = mongoose.model('BudgetStage', budgetStageSchema);



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

const contractorSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  name: String,
  contact: String,
  costEstimate: Number,
  fromDate: Date,
  toDate: Date
});

// Contractor Model
const Contractor = mongoose.model('Contractor', contractorSchema);


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
          quantity: String,  // Assuming quantity is a string based on your input type
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


////----------------------------EDIT PROJECTS(EDIT_PROJECT.EJS- MAIN DASHBOARD)
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
    const currentPage="to_do";
    const role = req.session.user.role;
    // Find the project and pass its todos to the template
    const project = await Project.findById(projectId);
    if (project) {
      res.render('to_do', { projectId,project,role,currentPage });}
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
app.get('/budget_stage/:projectId', async (req, res) => {
  const projectId = req.params.projectId;
  const project = { id: projectId, name: 'Sample Project' }; // Placeholder data
  const currentPage = "budget_Stage";
  const role = req.session.user.role;

  try {
      // Fetch existing budget stage data
      const budgetStage = await BudgetStage.findOne({ projectId });
      const stages = budgetStage ? budgetStage.stages : [];

      // Fetch totalStageAmount from the resources collection
      const resourceData = await Resource.findOne({ projectId });

      let totalAmount = 0; // Initialize totalAmount variable

      // If resource data exists, map totalStageAmount to corresponding stages and calculate totalAmount
      if (resourceData) {
          stages.forEach(stage => {
              const resourceStage = resourceData.stages.find(resStage => resStage.stage === stage.stage);
              if (resourceStage) {
                  stage.totalStageAmount = resourceStage.totalStageAmount || 0; // Default to 0 if not found
              }
          });
          // Calculate total amount spent across all stages
          totalAmount = resourceData.totalAmount || 0; // Use the totalAmount from resources collection
      }

      res.render('budget_Stage', { project, role, currentPage, stages, totalAmount }); // Pass totalAmount to EJS
  } catch (err) {
      console.error('Error fetching budget stage data:', err);
      res.render('budget_Stage', { project, role, currentPage, stages: [], totalAmount: 0 }); // Pass totalAmount as 0 in case of error
  }
});


// Route to save stage details
app.post('/save_stage_details', async (req, res) => {
    try {
        const { stages, projectId, totalEstimatedAmount } = req.body; // Destructure totalEstimatedAmount

        // Check if there's already a budget stage document for this project
        let budgetStage = await BudgetStage.findOne({ projectId });

        if (budgetStage) {
            // If it exists, update the stages and total estimated amount
            budgetStage.stages = stages;
            budgetStage.totalEstimatedAmount = totalEstimatedAmount; // Update total estimated amount
        } else {
            // If it doesn't exist, create a new document
            budgetStage = new BudgetStage({ projectId, stages, totalEstimatedAmount }); // Include total estimated amount
        }

        await budgetStage.save();

        res.json({ success: true });
    } catch (err) {
        console.error('Error saving stage details:', err);
        res.status(500).json({ success: false, message: 'Error: ' + err.message });
    }
});


//----------------------------MILESTONE
app.get('/milestone/:projectId', (req, res) => {
  const projectId = req.params.projectId;
  const project = { id: projectId, name: 'Sample Project' }; // Placeholder data
  const currentPage="milestone";
  const role = req.session.user.role;

    res.render('milestone', { project,role,currentPage });
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
    const { stages, projectId } = req.body; // Use 'stages' instead of 'milestones'

    // Validate projectId
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      console.error('Invalid projectId:', projectId);
      return res.status(400).json({ success: false, message: 'Invalid projectId' });
    }

    // Map the new stages
    const newStages = stages.map((stage, index) => ({
      stage: index + 1, // Make sure this is calculated correctly
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

    // Find the existing milestone document
    const milestoneStage = await MilestoneStage.findOneAndUpdate(
      { projectId: new mongoose.Types.ObjectId(projectId) },
      {
        $push: {
          stages: { $each: newStages } // Append the new stages to the existing ones
        }
      },
      { new: true, upsert: true } // Create a new document if none exists
    );

    res.json({ success: true, milestoneStage });
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

    // Map the milestone stages to only get the name and stage number
    const stageDetails = milestoneStages.map(stage => ({
      stage: stage.stage,
      name: stage.name
    }));

    res.render('resource', { project, stages, stageDetails, role, currentPage });
  } catch (err) {
    console.error('Error fetching resources:', err);
    res.status(500).send('Error: ' + err.message);
  }
});



app.post('/add_resource', async (req, res) => {
  try {
    const { projectId, stageCount } = req.body;
    const stages = [];
    let totalAmount = 0;  // To keep track of the total amount spent

    const numStages = parseInt(stageCount, 10);  // Parse the stage count as a number

    // Loop through each stage and gather resources
    for (let i = 1; i <= numStages; i++) {
      const resourceTypes = req.body[`resourceType-${i}`] || [];
      const quantities = req.body[`quantity-${i}`] || [];
      const amounts = req.body[`amount-${i}`] || [];

      let totalStageAmount = 0;  // To keep track of the total amount for the current stage

      // Process the resources in the current stage
      const stageResources = resourceTypes.map((resourceType, index) => {
        const amount = parseFloat(amounts[index]) || 0;
        totalStageAmount += amount;  // Add the resource amount to the stage total
        return {
          resourceType,
          quantity: quantities[index] || '0',  // Default quantity to '0' if not provided
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

app.delete('/delete_stage/:stageNumber', async (req, res) => {
  const { projectId } = req.body; // Get the projectId from the request body
  const stageNumber = req.params.stageNumber;

  try {
      // Find the resource document by projectId
      const resource = await Resource.findOne({ projectId });

      if (resource) {
          // Filter out the stage to be deleted
          resource.stages = resource.stages.filter(stage => stage.stage !== parseInt(stageNumber, 10));

          // Recalculate total amount
          resource.totalAmount = resource.stages.reduce((total, stage) => {
              return total + stage.resources.reduce((stageTotal, resource) => {
                  return stageTotal + resource.amount;
              }, 0);
          }, 0);

          await resource.save(); // Save updated resource document
          res.status(200).send('Stage deleted successfully.');
      } else {
          res.status(404).send('Resource not found.');
      }
  } catch (err) {
      console.error('Error deleting stage:', err);
      res.status(500).send('Error: ' + err.message);
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

app.get('/upload/:projectId', (req, res) => {
  const projectId = req.params.projectId;
  const project = { id: projectId, name: 'Sample Project' }; // Placeholder data

    res.render('upload', { project });
});
const documentSchema = new mongoose.Schema({
  filename: String,
  originalName: String,
  path: String,
  createdAt: { type: Date, default: Date.now },
  projectId: { type: String, required: true }, // New field to store project ID
});


const Document = mongoose.model('Document', documentSchema);

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = './uploads';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)); // Append timestamp to file name
  },
});

const upload = multer({ storage });

// Middleware to serve static files
app.use(express.static('uploads'));
app.use(express.urlencoded({ extended: true }));


async function getUniqueFilePath(dir, filename) {
  let uniquePath = path.join(dir, filename);
  let counter = 1;

  // Keep incrementing the counter until a unique file name is found
  while (fs.existsSync(uniquePath)) {
    const ext = path.extname(filename);
    const base = path.basename(filename, ext);
    uniquePath = path.join(dir, `${base} (${counter})${ext}`);
    counter++;
  }

  return uniquePath;
}


// Route to upload a new document
app.post('/upload', upload.single('document'), async (req, res) => {
  const userFilename = req.body.filename;
  const fileExtension = path.extname(req.file.originalname);

  const initialFilePath = path.join('./uploads', userFilename + fileExtension);
  
  // Get a unique file path
  const newFilePath = await getUniqueFilePath('./uploads', userFilename + fileExtension);

  fs.rename(req.file.path, newFilePath, async (err) => {
    if (err) {
      return res.status(500).send('Error renaming file');
    }

    const document = new Document({
      filename: userFilename + fileExtension,
      originalName: req.file.originalname,
      path: newFilePath,
      projectId: req.body.projectId,
    });

    await document.save();
    res.redirect('/');
  });
});




//----------------------------CONTRACTOR
// Route to fetch and render contractors for a specific project
// GET Route to Fetch Contractors
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
app.post('/contractor/add', async (req, res) => {
  const { projectId, name, contact, costEstimate, fromDate, toDate } = req.body;

  try {
    const contractor = new Contractor({
      projectId,
      name,
      contact,
      costEstimate,
      fromDate,
      toDate
    });

    await contractor.save();
    res.json({ message: 'Contractor added successfully' });
  } catch (error) {
    console.error('Error adding contractor:', error);
    res.status(500).json({ message: 'Error adding contractor' });
  }
});

// PUT Route to Update Contractor
app.put('/contractor/update/:id', async (req, res) => {
  const { id } = req.params;
  const { name, contact, costEstimate, fromDate, toDate } = req.body;

  try {
    const contractor = await Contractor.findById(id);
    if (!contractor) {
      return res.status(404).json({ message: 'Contractor not found' });
    }

    contractor.name = name;
    contractor.contact = contact;
    contractor.costEstimate = costEstimate;
    contractor.fromDate = new Date(fromDate);
    contractor.toDate = new Date(toDate);

    await contractor.save();
    res.json({ message: 'Contractor updated successfully' });
  } catch (error) {
    console.error('Error updating contractor:', error);
    res.status(500).json({ message: 'Error updating contractor' });
  }
});

//---------------------------------LISTENING TO PORT
//app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
