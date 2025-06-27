import axios from 'axios';

const API = axios.create({
    baseURL: 'http://localhost:8000/',
    timeout: 10000,
    headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
    },
});

API.interceptors.request.use(request => {
    console.log('Request URL:', request.url);
    console.log('Request Params:', request.params);
    console.log('Request Headers:', request.headers);
    return request;
});

API.interceptors.response.use(
    response => response,
    error => {
        console.error('Response Error:', {
            url: error.config?.url,
            status: error.response?.status,
            data: error.response?.data,
            message: error.message,
        });
        return Promise.reject(error);
    }
);

export default API;