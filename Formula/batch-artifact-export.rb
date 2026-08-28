class BatchArtifactExport < Formula
  desc "Deterministic batch exports through local converters"
  homepage "https://batch-artifact-export.sociobot.in"
  version "0.1.0"
  license "MIT"

  url "https://github.com/B-Divyesh/sf-batch-artifact-export/releases/download/v0.1.0/batch-artifact-export-macos-universal.tar.gz"
  sha256 "__MACOS_SHA256__"

  def install
    bin.install "batch-artifact-export"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/batch-artifact-export --version")
  end
end
