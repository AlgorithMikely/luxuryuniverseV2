try:
    import boto3
    print("boto3 is installed")
except ImportError:
    print("boto3 is NOT installed")

try:
    import aioboto3
    print("aioboto3 is installed")
except ImportError:
    print("aioboto3 is NOT installed")
