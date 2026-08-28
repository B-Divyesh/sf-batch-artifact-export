class BatchArtifactExport < Formula
  desc "Deterministic batch exports through local converters"
  homepage "https://batch-artifact-export.sociobot.in"
  version "0.1.0"
  license "MIT"

  url "https://github.com/B-Divyesh/sf-batch-artifact-export/releases/download/v0.1.0/batch-artifact-export-macos-universal.tar.gz"
  sha256 "4ddd7a69b32e2ec05b4f250a5890b7e71efe402df0e1ed02653ae915d8ddbe8a"

  def install
    bin.install "batch-artifact-export"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/batch-artifact-export --version")
  end
end
