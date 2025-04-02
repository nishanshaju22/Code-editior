import { createContext, useState, useEffect } from "react";
import axios from "axios";
import { jwtDecode } from "jwt-decode"; // Corrected import

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (token) {
      try {
        const decoded = jwtDecode(token);
        setUser({ username: decoded.username });

        // Optionally check token expiration and auto logout if expired
        const currentTime = Date.now() / 1000;
        if (decoded.exp < currentTime) {
          logout(); // Logout if token is expired
        }
      } catch (err) {
        console.error("Error decoding token:", err);
        logout(); // Logout if token is invalid
      }
    }
  }, []);

  const login = async (username, password) => {
    const res = await axios.post("http://localhost:5001/login", { username, password });
    const token = res.data.token;

    // Store the token in localStorage
    localStorage.setItem("token", token);

    // Decode token and set user data
    const decoded = jwtDecode(token);
    setUser({ username: decoded.username });
  };

  const logout = () => {
    localStorage.removeItem("token");  // Remove token from localStorage
    setUser(null);  // Clear user state
  };

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
};

export default AuthContext;
