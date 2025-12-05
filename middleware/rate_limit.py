from slowapi import Limiter
from slowapi.util import get_remote_address

# Initialize Limiter
# We use get_remote_address to identify users by IP
limiter = Limiter(key_func=get_remote_address)
