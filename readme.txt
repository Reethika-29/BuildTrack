BUILDTRACK:DASHBOARD FOR REAL-TIME MONITORING OF CONSTRUCTION PROJECTS
This is a Node.js application using MongoDB for the database. Follow the instructions below to set up and run the project.
Before running this application, ensure you have the following installed on your machine:

1. [Node.js](https://nodejs.org/) (v12.x or higher)
2. [MongoDB](https://www.mongodb.com/) (Ensure MongoDB is running locally or have access to a remote MongoDB cluster)
3. OBS Studio ( https://obsproject.com/)
4. Camo(https://reincubate.com/camo/downloads/)

Step 1: Download the zip file
Step 2: In _server.js file, change the MongoDB user credentials.
Step3: create a DB "sample" --> schema called "users" and add the following:
username: "your_name"
password:"your_MD_password"
role:"MD"
Step 3: Install dependencies using "npm install"
Step 4: Setup MongoDb using "mongod"
Step 4: Run the application using "npm start" or "node _server.js"

For CCTV:
Install Camo Studio and connect your device directly via webcam or external camera, or use Wi-Fi to connect to mobile phones using a QR code.
In OBS Studio choose Camo Studio as camera input and stream it.