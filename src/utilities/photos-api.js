import { uploadFile, sendRequest } from "./send-request";

export async function uploadPhoto(request) {
    return await uploadFile(`/api/photos/`, "POST", request)
}

export async function deletePhoto(id) {
    return await sendRequest(`/api/photos/${id}`, "DELETE")
}