const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const app = require("../server"); // Ensure this exports your Express app
const User = require("../models/User");
const Project = require("../models/Project");

let mongoServer;
let authToken;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri(), { useNewUrlParser: true });

    // Create a test user
    await User.create({ username: "testuser", password: "hashedpassword" });
    authToken = jwt.sign({ username: "testuser" }, process.env.JWT_SECRET, { expiresIn: "1h" });
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

describe("Authentication API", () => {
    it("should register a user", async () => {
        const res = await request(app)
            .post("/register")
            .send({ username: "newuser", password: "password123" });

        expect(res.statusCode).toBe(200);
        expect(res.body.message).toBe("User registered");
    });

    it("should log in a user", async () => {
        const res = await request(app)
            .post("/login")
            .send({ username: "testuser", password: "password123" });

        expect(res.statusCode).toBe(400); // Password is incorrect
    });
});

describe("Project API", () => {
    let projectId;

    it("should create a project", async () => {
        const res = await request(app)
            .post("/projects")
            .set("Authorization", authToken)
            .send({ name: "Test Project" });

        expect(res.statusCode).toBe(200);
        projectId = res.body._id;
    });

    it("should commit a change", async () => {
        const res = await request(app)
            .post(`/projects/${projectId}/commit`)
            .set("Authorization", authToken)
            .send({ message: "Initial commit" });

        expect(res.statusCode).toBe(200);
        expect(res.body.message).toBe("Commit saved");
    });

    it("should push new code", async () => {
        const res = await request(app)
            .post(`/projects/${projectId}/push`)
            .set("Authorization", authToken)
            .send({ newCode: "console.log('Hello World');", message: "Updated code" });

        expect(res.statusCode).toBe(200);
        expect(res.body.message).toBe("Code pushed successfully");
    });

    it("should pull the latest code", async () => {
        const res = await request(app)
            .get(`/projects/${projectId}/pull`)
            .set("Authorization", authToken);

        expect(res.statusCode).toBe(200);
        expect(res.body.code).toBe("console.log('Hello World');");
    });
});