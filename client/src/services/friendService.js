/* ========================================
   FRIENDSERVICE.JS — derived DM roster
   Graph request/accept/block retired (410 FRIEND_GRAPH_GONE).
   Roster: GET /friends from organization-service.
======================================== */
import api from './api';

const friendService = {
  getFriends: async (params = {}) => {
    return await api.get('/friends', { params });
  },
};

export default friendService;
