#!/usr/bin/env python3
"""Test runner for LangChain/LangGraph upgrade validation.

This script runs comprehensive tests to validate the upgrade from:
- LangGraph 0.2.38 → 1.0.20+
- LangChain 0.3.x → 0.3.14+
- Related dependencies

Usage:
    python run_upgrade_tests.py [OPTIONS]

Options:
    --quick         Run only essential tests (fast)
    --full          Run all tests including integration tests
    --no-live-api   Skip tests requiring live API calls
    --verbose       Show detailed output
    --report        Generate HTML coverage report
"""

import sys
import os
import subprocess
import argparse
from pathlib import Path


# Test categories
TEST_CATEGORIES = {
    "version": {
        "name": "Version Validation",
        "files": ["test_upgrade_validation.py"],
        "description": "Verify correct package versions installed",
        "essential": True
    },
    "langgraph": {
        "name": "LangGraph Integration",
        "files": ["test_langgraph_integration.py"],
        "description": "Test LangGraph 1.0 StateGraph functionality",
        "essential": True
    },
    "checkpoint": {
        "name": "Redis Checkpoint",
        "files": ["test_redis_checkpoint.py"],
        "description": "Test Redis checkpoint integration",
        "essential": True
    },
    "openai": {
        "name": "OpenAI LLM",
        "files": ["test_openai_llm.py"],
        "description": "Test OpenAI integration (focused on OpenAI only)",
        "essential": True
    },
    "stateful": {
        "name": "Stateful Retrieval",
        "files": ["test_stateful_retrieval_upgrade.py"],
        "description": "Test upgraded stateful retrieval pipeline",
        "essential": True
    },
    "existing": {
        "name": "Existing Tests",
        "files": ["test_ingestion_pipeline.py", "test_metrics_api.py"],
        "description": "Run existing test suite for regression",
        "essential": False
    }
}


class Colors:
    """ANSI color codes for terminal output."""
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'


def print_header(message):
    """Print formatted header."""
    print(f"\n{Colors.BOLD}{Colors.CYAN}{'='*70}{Colors.ENDC}")
    print(f"{Colors.BOLD}{Colors.CYAN}{message}{Colors.ENDC}")
    print(f"{Colors.BOLD}{Colors.CYAN}{'='*70}{Colors.ENDC}\n")


def print_section(message):
    """Print formatted section."""
    print(f"\n{Colors.BOLD}{Colors.BLUE}► {message}{Colors.ENDC}")


def print_success(message):
    """Print success message."""
    print(f"{Colors.GREEN}✅ {message}{Colors.ENDC}")


def print_warning(message):
    """Print warning message."""
    print(f"{Colors.YELLOW}⚠️  {message}{Colors.ENDC}")


def print_error(message):
    """Print error message."""
    print(f"{Colors.RED}❌ {message}{Colors.ENDC}")


def check_environment():
    """Check that we're in the correct directory and environment."""
    cwd = Path.cwd()

    # Check if tests directory exists
    tests_dir = cwd / "tests"
    if not tests_dir.exists():
        # Maybe we're in the wrong directory
        rag_service_tests = cwd / "rag-service" / "tests"
        if rag_service_tests.exists():
            print_warning("Changing directory to rag-service/")
            os.chdir(cwd / "rag-service")
            return True

        print_error("Cannot find tests directory!")
        print(f"Current directory: {cwd}")
        print("Please run from rag-service/ directory")
        return False

    return True


def run_pytest(test_files, options, category_name):
    """Run pytest with specified files and options."""
    print_section(f"Running {category_name}")

    # Build pytest command
    cmd = ["python", "-m", "pytest"]

    # Add test files
    for test_file in test_files:
        test_path = Path("tests") / test_file
        if test_path.exists():
            cmd.append(str(test_path))
        else:
            print_warning(f"Test file not found: {test_file}")

    # Add pytest options
    cmd.extend(["-v", "--tb=short"])

    if options.verbose:
        cmd.append("-s")  # Show print statements

    if options.no_live_api:
        cmd.append("-m")
        cmd.append("not live_api")

    # Run pytest
    print(f"Command: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=False)

    return result.returncode == 0


def run_tests(options):
    """Run test suite based on options."""
    print_header("LangChain/LangGraph Upgrade Test Suite")

    # Determine which categories to run
    if options.quick:
        categories_to_run = {k: v for k, v in TEST_CATEGORIES.items() if v["essential"]}
        print_section("Quick Mode: Running essential tests only")
    else:
        categories_to_run = TEST_CATEGORIES
        print_section("Full Mode: Running all tests")

    print()
    for name, info in categories_to_run.items():
        status = "✓" if info["essential"] else "○"
        print(f"  {status} {info['name']}: {info['description']}")

    # Run each category
    results = {}
    for category_name, category_info in categories_to_run.items():
        success = run_pytest(
            category_info["files"],
            options,
            category_info["name"]
        )
        results[category_name] = success

        if success:
            print_success(f"{category_info['name']} passed")
        else:
            print_error(f"{category_info['name']} failed")

    # Generate summary
    print_header("Test Summary")

    total = len(results)
    passed = sum(1 for v in results.values() if v)
    failed = total - passed

    print(f"Total test categories: {total}")
    print(f"{Colors.GREEN}Passed: {passed}{Colors.ENDC}")
    if failed > 0:
        print(f"{Colors.RED}Failed: {failed}{Colors.ENDC}")
    print()

    # Detailed results
    for category_name, success in results.items():
        status = "✅" if success else "❌"
        print(f"  {status} {TEST_CATEGORIES[category_name]['name']}")

    # Generate coverage report if requested
    if options.report:
        print_section("Generating coverage report")
        cmd = [
            "python", "-m", "pytest",
            "tests/",
            "--cov=app",
            "--cov-report=html",
            "--cov-report=term"
        ]
        subprocess.run(cmd)
        print_success("Coverage report generated: htmlcov/index.html")

    # Return overall success
    return failed == 0


def check_dependencies():
    """Check that required dependencies are installed."""
    print_section("Checking dependencies")

    required = {
        "pytest": "pytest",
        "pytest-asyncio": "pytest-asyncio",
        "packaging": "packaging",
        "langgraph": "langgraph",
        "langchain": "langchain",
    }

    missing = []
    for package, import_name in required.items():
        try:
            __import__(import_name)
            print(f"  ✓ {package}")
        except ImportError:
            print(f"  ✗ {package}")
            missing.append(package)

    if missing:
        print_error(f"Missing dependencies: {', '.join(missing)}")
        print("\nInstall with:")
        print(f"  pip install {' '.join(missing)}")
        return False

    print_success("All dependencies available")
    return True


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Run LangChain/LangGraph upgrade validation tests",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Run essential tests only
  python run_upgrade_tests.py --quick

  # Run all tests
  python run_upgrade_tests.py --full

  # Run tests without live API calls
  python run_upgrade_tests.py --no-live-api

  # Generate coverage report
  python run_upgrade_tests.py --report

  # Verbose output
  python run_upgrade_tests.py --verbose
        """
    )

    parser.add_argument(
        "--quick",
        action="store_true",
        help="Run only essential tests (faster)"
    )
    parser.add_argument(
        "--full",
        action="store_true",
        help="Run all tests including integration tests (default)"
    )
    parser.add_argument(
        "--no-live-api",
        action="store_true",
        help="Skip tests requiring live API calls"
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Show detailed output"
    )
    parser.add_argument(
        "--report",
        action="store_true",
        help="Generate HTML coverage report"
    )

    args = parser.parse_args()

    # Default to full if neither quick nor full specified
    if not args.quick and not args.full:
        args.full = True

    # Check environment
    if not check_environment():
        sys.exit(1)

    # Check dependencies
    if not check_dependencies():
        sys.exit(1)

    # Run tests
    success = run_tests(args)

    # Exit with appropriate code
    if success:
        print_header("All Tests Passed! ✅")
        print("The LangChain/LangGraph upgrade validation is complete.")
        print()
        sys.exit(0)
    else:
        print_header("Some Tests Failed ❌")
        print("Please review the failures above and address issues.")
        print()
        print("For detailed logs, run with --verbose flag:")
        print("  python run_upgrade_tests.py --verbose")
        print()
        sys.exit(1)


if __name__ == "__main__":
    main()
