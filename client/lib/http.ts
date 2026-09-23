type HttpOptionsType = RequestInit;

type AppResponse = Record<string, any>;

export class FetchError extends Error {
  status: number;
  message: string;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.message = message;
  }

  static isFetchError(error: unknown): error is FetchError {
    return error instanceof FetchError;
  }
}

type ApiReturn<ResponseType> = ResponseType;

/**
 * The message of a thrown value when it carries one, '' otherwise — so callers
 * can `|| fallback` their own wording, exactly like `error?.message ||` did.
 */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }
  return '';
}

/**
 * Wrapper around fetch to make it easy to handle errors
 *
 * @param url
 * @param options
 */
export async function httpCall<ResponseType = AppResponse>(
  url: string,
  options?: HttpOptionsType
): Promise<ApiReturn<ResponseType>> {
  try {
    const isMultiPartFormData = options?.body instanceof FormData;

    const headers = new Headers({
      Accept: 'application/json',
      ...(options?.headers ?? {}),
    });

    if (!isMultiPartFormData) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(url, {
      credentials: 'include',
      ...options,
      headers,
    });

    // Read from the Headers actually sent — case-insensitive, and no reach
    // back into the loose options shape.
    const doesAcceptHtml = headers.get('Accept') === 'text/html';

    const data = doesAcceptHtml ? await response.text() : await response.json();

    if (!response.ok) {
      // A signed-in user with no organization: every dashboard call answers
      // this, and the only useful response is the onboarding that makes one.
      if (response.status === 403 && data?.code === 'no-workspace' && typeof window !== 'undefined') {
        window.location.assign('/onboarding');
      }
      if ('errors' in data) {
        throw new FetchError(response.status, data.message);
      } else {
        throw new Error('An unexpected error occurred');
      }
    }

    return data as ResponseType;
  } catch (error) {
    throw error;
  }
}

export async function httpPost<ResponseType = AppResponse>(
  url: string,
  body: Record<string, any>,
  options?: HttpOptionsType
): Promise<ApiReturn<ResponseType>> {
  return httpCall<ResponseType>(url, {
    ...options,
    method: 'POST',
    body: body instanceof FormData ? body : JSON.stringify(body),
  });
}

export async function httpGet<ResponseType = AppResponse>(
  url: string,
  queryParams?: Record<string, any>,
  options?: HttpOptionsType
): Promise<ApiReturn<ResponseType>> {
  const searchParams = new URLSearchParams(queryParams).toString();
  const queryUrl = searchParams ? `${url}?${searchParams}` : url;

  return httpCall<ResponseType>(queryUrl, options);
}

export async function httpPut<ResponseType = AppResponse>(
  url: string,
  body: Record<string, any>,
  options?: HttpOptionsType
): Promise<ApiReturn<ResponseType>> {
  return httpCall<ResponseType>(url, {
    ...options,
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function httpDelete<ResponseType = AppResponse>(
  url: string,
  options?: HttpOptionsType
): Promise<ApiReturn<ResponseType>> {
  return httpCall<ResponseType>(url, {
    ...options,
    method: 'DELETE',
  });
}
