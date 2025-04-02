const { Server } = require("socket.io");
const { createServer } = require("http");
const { io } = require("socket.io-client");

let httpServer, ioServer, client1, client2;

beforeAll((done) => {
    httpServer = createServer();
    ioServer = new Server(httpServer);
    httpServer.listen(() => {
        const port = httpServer.address().port;
        client1 = io(`http://localhost:${port}`);
        client2 = io(`http://localhost:${port}`);
        done();
    });
});

afterAll(() => {
    ioServer.close();
    client1.close();
    client2.close();
});

test("Real-time code update", (done) => {
    const projectId = "testProject123";
    client1.emit("joinProject", projectId);
    client2.emit("joinProject", projectId);

    client2.on("codeUpdate", (newCode) => {
        expect(newCode).toBe("New Code Update");
        done();
    });

    client1.emit("codeUpdate", { projectId, newCode: "New Code Update" });
});