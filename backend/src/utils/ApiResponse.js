// error response & api response are alway in class format
// we're creating this to standardise our api responses where we at times dotn forget to send stuff
class ApiResponse {
  constructor(statusCode, data, message = "Success") {
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
    this.success = statusCode < 400; // todo learn about status code ranges to understand this
  }
}

export { ApiResponse };
