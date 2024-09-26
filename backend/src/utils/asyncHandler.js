// we're creating this to standardise error handling & avoid try catch always

const asyncHandler = (requestHandler) => {
  return (req, res, next) => {
    //it seems we can also have a 4th parameter as error
    Promise.resolve(requestHandler(req, res, next)).catch((err) => next(err));
  };
};

export { asyncHandler };
