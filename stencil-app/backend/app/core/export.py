"""Serialize a trimesh.Trimesh to STL bytes."""

import trimesh


def to_stl_bytes(mesh: trimesh.Trimesh, binary: bool = True) -> bytes:
    file_type = "stl" if binary else "stl_ascii"
    return mesh.export(file_type=file_type)
