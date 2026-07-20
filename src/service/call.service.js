import { onGetTurnCredentials } from './call/turn.service.js';
import { onMakeCall, onEndCall, onAcceptCall } from './call/session.service.js';

export const CALL_SERVICE = {
    onGetTurnCredentials,
    onMakeCall,
    onEndCall,
    onAcceptCall
};