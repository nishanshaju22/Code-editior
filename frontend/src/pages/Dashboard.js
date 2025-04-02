import { useState, useEffect, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthContext from "../context/AuthContext";
import axios from "axios";

const Dashboard = () => {
  const { user, logout } = useContext(AuthContext);
  const [projects, setProjects] = useState([]);
  const [showModal, setShowModal] = useState(false); // Manage modal visibility
  const [projectName, setProjectName] = useState(""); // Store project name
  const navigate = useNavigate();

  useEffect(() => {
    axios.get("http://localhost:5001/projects", { headers: { Authorization: user.token } })
      .then(res => setProjects(res.data))
      .catch(err => console.error(err));
  }, []);

  const handleCreateProject = () => {
    if (!projectName) return alert("Project name is required");

    axios.post("http://localhost:5001/projects", { name: projectName }, { headers: { Authorization: localStorage.getItem("token") } })
      .then(res => {
        setProjects(prev => [...prev, res.data]);  // Update project list
        setProjectName("");  // Clear input field
        setShowModal(false); // Close modal
      })
      .catch(err => console.error(err));
  };

  const handleLogout = () => {
    logout();  // Call the logout function from AuthContext
    navigate("/");  // Redirect to login page after logout
  };

  return (
    <div className="min-h-screen bg-gray-100 flex">
      <div className="flex-1 m-2 bg-white p-6 shadow-md">
        <div className="flex justify-between items-center bg-white p-4 shadow-md">
          <h1 className="text-2xl font-bold">Welcome, {user?.name}</h1>
          <button onClick={handleLogout} className="bg-red-500 text-white px-4 py-2 rounded">
            Logout
          </button>
        </div>

        <div className="mt-6">
          <h2 className="text-xl font-bold mb-2">Your Projects</h2>
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-500 text-white px-4 py-2 mb-4 rounded"
          >
            Create New Project
          </button>

          <div>
            {projects.length > 0 ? (
              <ul>
                {projects.map((project, index) => (
                  <li key={index} className="mb-2 p-2 bg-gray-200 rounded">
                    <Link to={`/editor/${project._id}`} className="text-blue-500">
                        {project.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No projects found. Create one to get started!</p>
            )}
          </div>
        </div>
      </div>

      {/* Modal to create new project */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-50 flex justify-center items-center">
          <div className="bg-white p-6 rounded shadow-md w-1/3">
            <h3 className="text-xl font-bold mb-4">Create New Project</h3>
            <input
              type="text"
              className="w-full p-2 mb-4 border border-gray-300 rounded"
              placeholder="Enter project name"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
            />
            <div className="flex justify-end space-x-2">
              <button onClick={() => setShowModal(false)} className="bg-gray-400 text-white px-4 py-2 rounded">
                Cancel
              </button>
              <button onClick={handleCreateProject} className="bg-blue-500 text-white px-4 py-2 rounded">
                Create Project
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
