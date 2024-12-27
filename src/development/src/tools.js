export const log = (content, condition = true) => {
  if (condition) {
    console.log(content)
  }
}

export async function safeExecute(operation, errorHandler = console.error) {
  try {
      return await operation();
  } catch (error) {
      if (errorHandler) errorHandler(error);
      return null; // Return null or handle as needed in your application
  }
}