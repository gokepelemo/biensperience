import { uploadFile, sendRequest } from "./send-request";

const BASE_URL = `/api/photos/`

export async function uploadPhoto(request) {
    return await uploadFile(`${BASE_URL}`, "POST", request)
}

export async function deletePhoto(id) {
    return await sendRequest(`${BASE_URL}${id}`, "DELETE")
}