"""Fetch the pinned Italian Piper voices for the Docker build."""

import hashlib
import json
from pathlib import Path
import sys
from urllib.request import urlopen


REVISION = 'c10ece1aade47bb51c153c893d14e5bf8e5b7117'
BASE_URL = f'https://huggingface.co/rhasspy/piper-voices/resolve/{REVISION}/it/it_IT'
FILES = {
    'riccardo/x_low/it_IT-riccardo-x_low.onnx': '1368de15f123275a7ef951c9e5e30be0f58a032daa14a0da44037443c1d1d21b',
    'riccardo/x_low/it_IT-riccardo-x_low.onnx.json': '146ab9c634afe524e9fb7530f2510df7a42fb1db56b52658ca1fb3d98001a62a',
    'riccardo/x_low/MODEL_CARD': '7ce3b2fc4f454c84936887971574e436cc2154049b427a530f70bee050b2fdc6',
    'paola/medium/it_IT-paola-medium.onnx': '6fc918b5a0ea6137382833dddfa567bffbe6a5060c02043c87192ee59c04210c',
    'paola/medium/it_IT-paola-medium.onnx.json': 'aea19c0a7fce29fbc359b93f10e7902854401e4c95ae2ea328ae516b15d296cf',
    'paola/medium/MODEL_CARD': 'c53fd0070dc93b438edbce06728eb83759ba030fff0cce523209ee4a0a6363c0',
}


def fetch(destination: Path, source: str, expected: str) -> None:
    temporary = destination.with_name(f'.{destination.name}.download')
    digest = hashlib.sha256()
    try:
        with urlopen(f'{BASE_URL}/{source}', timeout=60) as response, temporary.open('wb') as output:
            while chunk := response.read(1024 * 1024):
                output.write(chunk)
                digest.update(chunk)
        if digest.hexdigest() != expected:
            raise ValueError(f'SHA-256 mismatch for {source}')
        if destination.name.endswith('.onnx.json'):
            metadata = json.loads(temporary.read_text())
            if metadata.get('dataset') not in ('riccardo', 'paola'):
                raise ValueError(f'Unexpected metadata for {source}')
        temporary.replace(destination)
    finally:
        temporary.unlink(missing_ok=True)


def main() -> None:
    directory = Path(sys.argv[1])
    directory.mkdir(parents=True, exist_ok=True)
    for source, expected in FILES.items():
        name = source.replace('/', '-') if source.endswith('MODEL_CARD') else source.rsplit('/', 1)[1]
        fetch(directory / name, source, expected)
        print(f'Fetched {name}: {expected}', flush=True)


if __name__ == '__main__':
    main()
