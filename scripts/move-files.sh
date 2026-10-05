#!/usr/bin/env bash
files_zip="$HOME/Downloads/files.zip"
if [[ -f "${file}" ]]; then
  echo "${file}"
  mv "${file}" archives
  unzip files.zip
  rm -f files.zip && echo "Deleted files.zip"
fi
