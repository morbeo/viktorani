#!/usr/bin/env bash
# set -euo pipefail
shopt -s extglob

PATCH_DIR="$HOME/Downloads"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${REPO_ROOT:-$(pwd)}"
DEPLOY_DIR="$REPO_ROOT/deploy"

if [[ $1 =~ '--clear' ]]; then
  rm -rf ${DEPLOY_DIR:?}/*
  echo "$DEPLOY_DIR cleared"
fi

patch_files=( $PATCH_DIR/patch-*.tar.gz )
if [[ "${#patch_files[@]}" -eq 0 ]]; then
  echo "No patch files found in $PATCH_DIR"
  exit
fi
for file in ${patch_files[@]}; do
  if [[ -f "${file}" ]]; then
    file_base=$(basename $file)
    read -r -p"Do you want to extract ${file_base} to $DEPLOY_DIR? "
    if [[ $REPLY =~ Y|y ]]; then
      extracted_folder=$(tar xvzf "${file}" -C $DEPLOY_DIR |& awk 'NR==1 {print $2}')
      if [[ -d "${extracted_folder}" ]]; then echo "Extracted to deploy/${extracted_folder}"; fi
      rm -f "${file}" && echo "${file} deleted"
      DEPLOY_SCRIPT=$(find "deploy/${extracted_folder}" -name '*.sh')
      if [[ -f "$DEPLOY_SCRIPT" ]]; then
        read -r -p"Do you want to run $DEPLOY_SCRIPT? "
        if [[ $REPLY =~ Y|y ]]; then $DEPLOY_SCRIPT; fi
      fi
    fi
  fi
done
