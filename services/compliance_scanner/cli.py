from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# Allow running as `python services/compliance_scanner/cli.py ...` from repo root
_REPO_ROOT = Path(__file__).resolve().parents[2]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from services.compliance_scanner.scanner.ci_scanner import scan_repo_lexical  # noqa: E402
from services.compliance_scanner.scanner.sarif import findings_to_sarif  # noqa: E402


def main() -> int:
    p = argparse.ArgumentParser(prog="compliance-scanner")
    sub = p.add_subparsers(dest="cmd", required=True)

    ci = sub.add_parser("scan-ci", help="Fast lexical compliance scan for CI")
    ci.add_argument("--repo", default=".", help="Repo root directory")
    ci.add_argument("--controls", default=None, help="Path to controls/catalog.yaml")
    ci.add_argument("--out", default="compliance-findings.json", help="Write findings JSON here")
    ci.add_argument("--sarif", default="compliance.sarif.json", help="Write SARIF here")
    ci.add_argument("--max-files", type=int, default=None, help="Limit number of files to scan")
    ci.add_argument("--fail-on", choices=["none", "non_compliant", "unknown"], default="non_compliant")

    args = p.parse_args()

    if args.cmd == "scan-ci":
        findings = scan_repo_lexical(repo_root=args.repo, controls_path=args.controls, max_files=args.max_files)
        Path(args.out).write_text(json.dumps([f.model_dump(mode="json") for f in findings], indent=2))
        Path(args.sarif).write_text(json.dumps(findings_to_sarif(findings, repo_root=args.repo), indent=2))

        if args.fail_on == "none":
            return 0
        if args.fail_on == "unknown" and any(f.status.value in ("non_compliant", "unknown") for f in findings):
            return 2
        if args.fail_on == "non_compliant" and any(f.status.value == "non_compliant" for f in findings):
            return 2
        return 0

    return 1


if __name__ == "__main__":
    raise SystemExit(main())

