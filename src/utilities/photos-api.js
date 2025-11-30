import { uploadFile, sendRequest } from "./send-request.js";
import { logger } from "./logger.js";
import { broadcastEvent } from "./event-bus.js";

const BASE_URL = `/api/photos/`

export async function uploadPhoto(request) {
    const result = await uploadFile(`${BASE_URL}`, "POST", request);

    // Emit event via event bus (handles local + cross-tab dispatch)
    try {
        if (result) {
            broadcastEvent('photo:created', { photo: result });
            logger.debug('[photos-api] Photo created event dispatched', { id: result._id });
        }
    } catch (e) {
        // ignore
    }

    return result;
}

export async function uploadPhotoBatch(request) {
    const result = await uploadFile(`${BASE_URL}batch`, "POST", request);

    // Emit event via event bus (handles local + cross-tab dispatch)
    try {
        if (result) {
            broadcastEvent('photos:created', { photos: result });
            logger.debug('[photos-api] Photos batch created event dispatched', { count: result?.length });
        }
    } catch (e) {
        // ignore
    }

    return result;
}

export async function uploadPhotoUrl(data) {
    const result = await sendRequest(`${BASE_URL}url`, "POST", data);

    // Emit event via event bus (handles local + cross-tab dispatch)
    try {
        if (result) {
            broadcastEvent('photo:created', { photo: result });
            logger.debug('[photos-api] Photo URL created event dispatched', { id: result._id });
        }
    } catch (e) {
        // ignore
    }

    return result;
}

export async function deletePhoto(id) {
    const result = await sendRequest(`${BASE_URL}${id}`, "DELETE");

    // Emit event via event bus (handles local + cross-tab dispatch)
    try {
        broadcastEvent('photo:deleted', { photoId: id });
        logger.debug('[photos-api] Photo deleted event dispatched', { id });
    } catch (e) {
        // ignore
    }

    return result;
}