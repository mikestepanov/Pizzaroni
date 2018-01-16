var express = require('express');
var bodyParser = require('body-parser');
var axios = require('axios');
var items = require('../database-mysql');
var app = express();
var path = require('path');
var server = require('http').createServer(app);
var io = require('socket.io')(server);

server.listen(3000, function() {
  console.log('listening on port 3000!');
});

app.use(express.static(__dirname + '/../react-client/dist'));
app.use(bodyParser.json());


var usernames = {};
var rooms = {};

io.on('connection', function(socket) {
  console.log('made socket connection ', socket.id);

  socket.on('addUser', function(username) {
    socket.username = username;
    socket.room = 'lobby';
    usernames[username] = username;
    if (rooms[socket.room] === undefined) {
      rooms[socket.room] = {
        roomName: socket.room,
        roomUsers: {
          [username]: [socket.username, socket.id]
        }
      };
    } else {
      rooms[socket.room].roomUsers[username] = [socket.username, socket.id];
    }

    socket.join('lobby');

    socket.emit('receiveMessage', {
      username: 'SERVER',
      message: 'you have connected to lobby chat'
    });

    socket.broadcast.to('lobby').emit('receiveMessage', {
      username: 'SERVER',
      message: `${username} has connected to this room`
    });

    // socket.emit.to(socket.room).emit('updateRoomUsers', usernames);
    // io.emit('updateRoomUsers', usernames);
    io.sockets.in(socket.room).emit('updateRoomUsers', rooms[socket.room].roomUsers);
  });

  // socket.on('sendToppingsUpdate', function(toppings) {
  //   io.sockets.emit('receiveToppingsUpdate', toppings);
  // });

  socket.on('sendMessage', function(message) {
    io.sockets.in(socket.room).emit('receiveMessage', message);
  });

  socket.on('typing', function(user) {
    socket.broadcast.to(socket.room).emit('typing', user);
  });

  socket.on('clearTyping', function() {
    socket.broadcast.to(socket.room).emit('clearTyping');
  });

  socket.on('inviteUser', function(userSendingInvite, socketIDofUserAcceptingInvite, newRoom) {
    if (io.sockets.connected[socketIDofUserAcceptingInvite]) {
      io.sockets.connected[socketIDofUserAcceptingInvite].emit('receiveRoomInvite', newRoom);
    }
  });

  socket.on('switchRoom', function(newRoom) {
    socket.leave(socket.room);
    //check if new rooms already exists
    //if not, create it and add the creating user to its
    //roomUsers list
    if (rooms[newRoom] === undefined) {
      rooms[newRoom] = {
        roomName: newRoom,
        roomUsers: {
          [socket.username]: [socket.username, socket.id]
        }
      };
      //IF IT EXISTS, simply add the curret user to its roomUsers
      // list
    } else {
      rooms[newRoom].roomUsers[socket.username] = [socket.username, socket.id];
    }

    // delete the current user from the active users of a room which
    // this user just left and have them update their userlist
    delete rooms[socket.room].roomUsers[socket.username];
    io.sockets.in(socket.room).emit('updateRoomUsers', rooms[socket.room].roomUsers);

    socket.join(newRoom);
    socket.emit('receiveMessage', {
      username: 'SERVER',
      message: `you have connected to room ${newRoom}`
    });
    // this actually emits a "goodbye" to the old room BEFORE reassigning new room
    socket.broadcast.to(socket.room).emit('receiveMessage', {
      username: 'SERVER',
      message: `${socket.username} has left this room`
    });

    //NOW reassign room:
    socket.room = newRoom;

    socket.broadcast.to(newRoom).emit('receiveMessage', {
      username: 'SERVER',
      message: `${socket.username} has joined this room`
    });

    io.sockets.in(socket.room).emit('updateRoomUsers', rooms[socket.room].roomUsers);
  });

  socket.on('disconnect', function() {
    delete usernames[socket.username];
    if (rooms[socket.room]) {
      delete rooms[socket.room].roomUsers[socket.username];
      io.sockets.in(socket.room).emit('updateRoomUsers', rooms[socket.room].roomUsers)
    }
    socket.broadcast.to(socket.room).emit('receiveMessage', {
      username: 'SERVER',
      message: `${socket.username} has disconnected`
    });
    socket.leave(socket.room);
  });
});


app.get('/sizes', function (req, res) {
  items.getAllSizes(function(err, data) {
    if(err) {
      res.sendStatus(500);
    } else {
      res.json(data);
    }
  });
});

app.get('/toppings', function (req, res) {
  items.getAllToppings(function(err, data) {
    if(err) {
      res.sendStatus(500);
    } else {
      res.json(data);
    }
  });
});

app.get('/crusts', function (req, res) {
  items.getAllCrusts(function(err, data) {
    if(err) {
      res.sendStatus(500);
    } else {
      res.json(data);
    }
  });
});

app.post('/save', function (req, res) {
  items.savePizza(req.body, function(err, data) {
    if(err) {
      res.sendStatus(500);
    } else {
      var pizzaId = data.insertId;
      items.saveToppings(pizzaId, req.body, function(err, data) {
        if (err) {
          res.sendStatus(500);
        } else {
          res.json(data);
        }
      })
    }
  });
});

app.get('/users/:username', function (req, res) {
  var username = req.params.username;
  items.checkUser(username, function(err, data) {
    if(err) {
      res.json(500);
    } else {
      res.json(data);
    }
  });
});

//'Username is already taken. You are screwed.'

app.post('/users/:username', function (req, res) {
  var username = req.params.username;
  items.saveUser(username, req.body.password, function(err, data) {
    if(err) {
      console.log('error is', err);
      res.sendStatus(500);
    } else {
      res.json(data);
    }
  });
});
