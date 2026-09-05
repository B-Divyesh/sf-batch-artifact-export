class BatchArtifactExport < Formula
  desc "Deterministic batch exports through local converters"
  homepage "https://batch-artifact-export.sociobot.in"
  version "0.1.1"
  license "MIT"

  url "https://github.com/B-Divyesh/sf-batch-artifact-export/releases/download/v0.1.1/batch-artifact-export-macos-universal.tar.gz"
  sha256 "f0b7d8f2eedb768f1ad2189a031390a88b1dfbbf47e8813a8566db6c80f72a05"

  def install
    bin.install "batch-artifact-export"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/batch-artifact-export --version")
  end
end
