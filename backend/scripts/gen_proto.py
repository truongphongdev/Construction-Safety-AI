import sys
from pathlib import Path
from grpc_tools import protoc

def generate_proto():
    base_dir = Path(__file__).resolve().parent.parent
    proto_dir = base_dir / "app" / "proto"
    output_dir = base_dir / "app" / "proto"

    proto_file = proto_dir / "camera_stream.proto"
    
    if not proto_file.exists():
        print(f"Error: {proto_file} does not exist.")
        sys.exit(1)

    cmd = [
        "grpc_tools.protoc",
        f"-I{proto_dir}",
        f"--python_out={output_dir}",
        f"--grpc_python_out={output_dir}",
        str(proto_file),
    ]

    print(f"Generating proto stubs for {proto_file.name}...")
    exit_code = protoc.main(cmd)
    if exit_code == 0:
        print("Successfully generated proto stubs!")
        
        # Patch import in camera_stream_pb2_grpc.py for relative import inside package
        grpc_file = output_dir / "camera_stream_pb2_grpc.py"
        if grpc_file.exists():
            content = grpc_file.read_text(encoding="utf-8")
            patched_content = content.replace(
                "import camera_stream_pb2 as camera__stream__pb2",
                "from . import camera_stream_pb2 as camera__stream__pb2"
            )
            grpc_file.write_text(patched_content, encoding="utf-8")
            print("Patched relative import in camera_stream_pb2_grpc.py!")
    else:
        print(f"Failed to generate proto stubs. Exit code: {exit_code}")

if __name__ == "__main__":
    generate_proto()
