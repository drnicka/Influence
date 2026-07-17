const express = require('express');
const router = express.Router();
const { authRequired } = require('../middleware/auth');
const { listRooms, getRoom, createRoom, addMember, isMember } = require('../lib/roomStore');
const { getMemberByHandle, getMember } = require('../lib/memberStore');

// Enrich room with member details (handle + displayName)
function enrichRoom(room) {
  if (!room) return room;
  return {
    ...room,
    memberDetails: room.members.map(mid => {
      const m = getMember(mid);
      return m ? { id: m.id, handle: m.handle, displayName: m.displayName } : { id: mid, handle: '?', displayName: 'Unknown' };
    }),
  };
}

// List rooms the current member belongs to
router.get('/', authRequired, (req, res, next) => {
  try {
    if (!req.member) {
      return res.json([]);
    }
    res.json(listRooms(req.member.id).map(enrichRoom));
  } catch (err) { next(err); }
});

// Get room details
router.get('/:id', authRequired, (req, res, next) => {
  try {
    const room = getRoom(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (req.member && !room.members.includes(req.member.id)) {
      return res.status(403).json({ error: 'Not a member of this room' });
    }
    res.json(enrichRoom(room));
  } catch (err) { next(err); }
});

// Create a room
router.post('/', authRequired, (req, res, next) => {
  try {
    if (!req.member) {
      return res.status(400).json({ error: 'Register a member first to create rooms' });
    }
    const { name } = req.body || {};
    const room = createRoom({ name, createdBy: req.member.id });
    res.status(201).json(room);
  } catch (err) { next(err); }
});

// Invite a member by handle
router.post('/:id/invite', authRequired, (req, res, next) => {
  try {
    if (!req.member) {
      return res.status(400).json({ error: 'Auth required' });
    }
    const room = getRoom(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (!room.members.includes(req.member.id)) {
      return res.status(403).json({ error: 'Only room members can invite' });
    }

    const { handle } = req.body || {};
    if (!handle) return res.status(400).json({ error: 'handle is required' });

    const target = getMemberByHandle(handle);
    if (!target) return res.status(404).json({ error: `Member "${handle}" not found` });

    const updated = addMember(req.params.id, target.id);
    res.json(enrichRoom(updated));
  } catch (err) { next(err); }
});

module.exports = router;
