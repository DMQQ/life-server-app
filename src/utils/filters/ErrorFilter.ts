import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest();
    const response = ctx.getResponse();

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    //@ts-ignore
    const message = exception.response.message || exception.message;

    const devErrorResponse = {
      statusCode,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      errorName: exception?.name,
      message: message,
    };

    const prodErrorResponse = {
      statusCode,
      message,
    };
    response
      .status(statusCode)
      .json(
        process.env.NODE_ENV === 'development'
          ? devErrorResponse
          : prodErrorResponse,
      );
  }
}
