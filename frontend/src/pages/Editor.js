import { useEffect, useState, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import AuthContext from "../context/AuthContext";
import Editor from "@monaco-editor/react";
import axios from "axios";

const socket = io("http://localhost:5001");

const CodeEditor = () => {
  const { projectId } = useParams();
  const { user } = useContext(AuthContext);
  const [code, setCode] = useState("");
  const [history, setHistory] = useState([]);
  const navigate = useNavigate();  // Use navigate to go back to Dashboard

  useEffect(() => {
    socket.emit("joinProject", projectId);

    socket.on("codeUpdate", (newCode) => {
      setCode(newCode);
    });

    return () => {
      socket.off("codeUpdate");
    };
  }, [projectId]);

  // Fetch project code and history
  useEffect(() => {
    axios.get(`http://localhost:5001/projects/${projectId}/pull`, { headers: { Authorization: localStorage.getItem("token") } })
      .then(res => {
        setCode(res.data.code);
        setHistory(res.data.history);
      })
      .catch(err => console.error(err));
  }, [projectId]);

  // Fetch project history
  useEffect(() => {
    axios.get(`http://localhost:5001/projects/${projectId}/history`, { headers: { Authorization: localStorage.getItem("token") } })
      .then(res => setHistory(res.data))
      .catch(err => console.error("Error fetching history:", err));
  }, []);

  const handleEditorChange = (newCode) => {
    setCode(newCode);
    socket.emit("codeUpdate", { projectId, newCode });
  };

  const commitChanges = async () => {
    const message = prompt("Enter commit message:");
    if (!message) return;

    await axios.post(`http://localhost:5001/projects/${projectId}/commit`, { message }, { headers: { Authorization: localStorage.getItem("token") } });
    alert("Changes committed!");
  };

  const goBackToDashboard = () => {
    navigate("/dashboard");  // Navigate back to the Dashboard
  };

  const revertToVersion = async (versionIndex) => {
    try {
      await axios.post(`http://localhost:5001/projects/${projectId}/revert`, { versionIndex }, { headers: { Authorization: localStorage.getItem("token") } });
      alert("Code reverted successfully!");
    } catch (error) {
      console.error("Error reverting code:", error);
      alert("Failed to revert code.");
    }
  };

  return (
    <>
      <div className="flex flex-col lg:flex-row p-6 space-y-6 lg:space-y-0 bg-gray-50">
        {/* Editor Section */}
        <div className="w-full lg:w-3/4 bg-white rounded-lg shadow-md p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-gray-800">Project: {projectId}</h2>
            <button
              onClick={goBackToDashboard}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition duration-300"
            >
              Back to Dashboard
            </button>
          </div>
          
          <div className="flex justify-center">
            <Editor
              height="80vh"
              defaultLanguage="javascript"
              value={code}
              onChange={handleEditorChange}
              options={{
                selectOnLineNumbers: true,
                wordWrap: "on",
                minimap: { enabled: false },
                fontSize: 14,
                autoIndent: "full",
              }}
            />
          </div>
        </div>

        {/* Sidebar Section */}
        <div className="w-full lg:w-1/4 bg-gray-200 rounded-lg shadow-md p-6 space-y-6">
          <button
            onClick={commitChanges}
            className="w-full bg-green-500 text-white py-2 rounded-lg hover:bg-green-600 transition duration-300"
          >
            Commit Changes
          </button>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800">Commit History</h3>
            <ul className="space-y-2 max-h-60 overflow-y-auto">
              {history.map((h, i) => (
                <li key={i} className="flex justify-between text-sm text-gray-600">
                  <span className="font-medium">{h.timestamp}</span>: {h.message}
                  <button
                    onClick={() => revertToVersion(i)}
                    className="text-red-500 hover:text-red-600"
                  >
                    Revert
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
};

export default CodeEditor;
