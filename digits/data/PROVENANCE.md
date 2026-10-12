# MNIST educational subset: 3,000 images, 16 × 16

MNIST authors: Yann LeCun, Corinna Cortes and Christopher J. C. Burges. Original homepage: http://yann.lecun.com/exdb/mnist/

License: Creative Commons Attribution-ShareAlike 3.0 (CC BY-SA 3.0), as documented by Keras: https://keras.io/api/datasets/mnist/ and TensorFlow: https://www.tensorflow.org/api_docs/python/tf/keras/datasets/mnist/load_data . License terms: https://creativecommons.org/licenses/by-sa/3.0/legalcode . This resized and selected image dataset is distributed under the same license. The license applies to dataset images and their adaptations; it does not relicense the application code.

Source downloads: https://storage.googleapis.com/cvdf-datasets/mnist/ — the four standard gzip IDX files. Exact URLs, MD5 and SHA-256 checksums are in manifest.json. The data was prepared locally on 2026-10-10; no user images or private source files were uploaded to obtain it.

Changes: full 28 × 28 image area averaged to 16 × 16, rounded to unsigned bytes. No learned normalization, no fitted transform, no augmentation. Source identities and SHA-256 fingerprints of each transformed image are retained in manifest.json. Byte-identical images are removed before selecting the next candidate, including across splits.

Selection: deterministic per-class Fisher-Yates shuffle (Mulberry32, seed 42000 + digit for the official training set, 42100 + digit for the official test set). For each digit, first 200 eligible training-source records become train, next 50 validation. First 50 eligible test-source records become test. This gives 300 per digit overall, with 200/50/50 per class. Official test-source images never enter training or validation. The 500-image test has a separate binary file, fetched only for final evaluation. The trainer's training-data object contains train and validation only.

Rebuild with Node 20+: `node scripts/prepare-data.mjs` from the project root. Cached originals are ignored by packaging; prepared images, provenance and manifest are shipped. The original MNIST source data is not needed at runtime. Retain this attribution and license when sharing the prepared dataset.

This is a small teaching subset, not an MNIST benchmark result. Writing style, resizing and a small sample size affect generalization. Exact hash deduplication does not prove different writers or perceptually independent samples. Modified copies of the same handwriting should remain in one split.
