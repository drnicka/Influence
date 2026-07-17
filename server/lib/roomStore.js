const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const config = require('./config');

const roomsDir = path.join(config.dataDir, 'rooms');

function ensureRoomsDir() {
  if (!fs.existsSync(roomsDir)) {
    fs.mkdirSync(roomsDir, { recursive: true });
  }
}

function listRooms(memberId) {
  ensureRoomsDir();
  const files = fs.readdirSync(roomsDir).filter(f => f.endsWith('.json'));
  const rooms = files.map(f => JSON.parse(fs.readFileSync(path.join(roomsDir, f), 'utf-8')));

  if (memberId) {
    return rooms.filter(r => r.members.includes(memberId));
  }
  return rooms;
}

function getRoom(id) {
  const filePath = path.join(roomsDir, `${id}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function createRoom({ name, createdBy }) {
  ensureRoomsDir();

  if (!name || typeof name !== 'string' || name.trim().length < 1) {
    const err = new Error('Room name is required');
    err.statusCode = 400;
    throw err;
  }
  if (!createdBy) {
    const err = new Error('createdBy (memberId) is required');
    err.statusCode = 400;
    throw err;
  }

  const id = uuidv4();
  const room = {
    id,
    name: name.trim(),
    members: [createdBy],
    createdBy,
    createdAt: new Date().toISOString(),
  };

  fs.writeFileSync(path.join(roomsDir, `${id}.json`), JSON.stringify(room, null, 2));
  return room;
}

function addMember(roomId, memberId) {
  const room = getRoom(roomId);
  if (!room) return null;

  if (room.members.includes(memberId)) return room;

  room.members.push(memberId);
  fs.writeFileSync(path.join(roomsDir, `${roomId}.json`), JSON.stringify(room, null, 2));
  return room;
}

function removeMember(roomId, memberId) {
  const room = getRoom(roomId);
  if (!room) return null;

  room.members = room.members.filter(id => id !== memberId);
  fs.writeFileSync(path.join(roomsDir, `${roomId}.json`), JSON.stringify(room, null, 2));
  return room;
}

function isMember(roomId, memberId) {
  const room = getRoom(roomId);
  if (!room) return false;
  return room.members.includes(memberId);
}

module.exports = {
  ensureRoomsDir,
  listRooms,
  getRoom,
  createRoom,
  addMember,
  removeMember,
  isMember,
};
