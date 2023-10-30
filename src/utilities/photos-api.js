import { uploadFile, sendRequest } from "./send-request";

const BASE_URL = process.env.PRODUCTION ? `/api/photos/` : `https://biensperience-y5m5.onrender.com/api/photos/`

export async function uploadPhoto(request) {
    return await uploadFile(`${BASE_URL}`, "POST", request)
}

export async function deletePhoto(id) {
    return await sendRequest(`${BASE_URL}`, "DELETE")
}