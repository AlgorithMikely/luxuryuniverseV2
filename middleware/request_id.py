import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from contextvars import ContextVar

# ContextVars to access request details anywhere
request_id_ctx_var: ContextVar[str] = ContextVar("request_id", default=None)
ip_address_ctx_var: ContextVar[str] = ContextVar("ip_address", default=None)
user_agent_ctx_var: ContextVar[str] = ContextVar("user_agent", default=None)

class RequestIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Check if client sent a request ID
        request_id = request.headers.get("X-Request-ID")
        if not request_id:
            request_id = str(uuid.uuid4())
            
        ip_address = request.client.host if request.client else "unknown"
        user_agent = request.headers.get("user-agent", "unknown")
        
        # Set in context vars
        token_id = request_id_ctx_var.set(request_id)
        token_ip = ip_address_ctx_var.set(ip_address)
        token_ua = user_agent_ctx_var.set(user_agent)
        
        # Add to request state
        request.state.request_id = request_id
        
        try:
            response = await call_next(request)
            # Add to response headers
            response.headers["X-Request-ID"] = request_id
        finally:
            # Reset context vars
            request_id_ctx_var.reset(token_id)
            ip_address_ctx_var.reset(token_ip)
            user_agent_ctx_var.reset(token_ua)
        
        return response
