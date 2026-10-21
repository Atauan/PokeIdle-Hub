using System;
using System.Globalization;
using System.Runtime.InteropServices;

internal static class WinMemoryTrimmer
{
    private const uint ProcessSetQuota = 0x0100;
    private const uint ProcessQueryLimitedInformation = 0x1000;
    private const int ErrorAccessDenied = 5;
    private const int ErrorInvalidParameter = 87;
    private const long FileTimeUnixEpochMilliseconds = 11644473600000L;

    [StructLayout(LayoutKind.Sequential)]
    private struct FileTime
    {
        public uint Low;
        public uint High;
    }

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr OpenProcess(uint access, bool inheritHandle, int processId);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool GetProcessTimes(IntPtr process, out FileTime creation, out FileTime exit, out FileTime kernel, out FileTime user);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool CloseHandle(IntPtr handle);

    [DllImport("psapi.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool EmptyWorkingSet(IntPtr process);

    private static long ToFileTime(FileTime value)
    {
        return ((long)value.High << 32) | value.Low;
    }

    private static string TrimProcess(int processId, double expectedCreationTime)
    {
        IntPtr handle = OpenProcess(ProcessSetQuota | ProcessQueryLimitedInformation, false, processId);
        if (handle == IntPtr.Zero)
        {
            int error = Marshal.GetLastWin32Error();
            if (error == ErrorAccessDenied) return "access-denied";
            if (error == ErrorInvalidParameter) return "process-exited";
            return "open-failed";
        }

        try
        {
            FileTime creation;
            FileTime exit;
            FileTime kernel;
            FileTime user;
            if (!GetProcessTimes(handle, out creation, out exit, out kernel, out user)) return "process-query-failed";

            double actualCreationTime = ToFileTime(creation) / 10000.0 - FileTimeUnixEpochMilliseconds;
            if (Math.Abs(actualCreationTime - expectedCreationTime) > 1000.0) return "identity-mismatch";
            return EmptyWorkingSet(handle) ? "trimmed" : "trim-failed";
        }
        finally
        {
            CloseHandle(handle);
        }
    }

    private static int Main()
    {
        string line;
        while ((line = Console.ReadLine()) != null)
        {
            string[] parts = line.Split('\t');
            int processId;
            double creationTime;
            if (parts.Length != 2
                || !Int32.TryParse(parts[0], NumberStyles.None, CultureInfo.InvariantCulture, out processId)
                || processId <= 0
                || !Double.TryParse(parts[1], NumberStyles.Float, CultureInfo.InvariantCulture, out creationTime)
                || Double.IsNaN(creationTime)
                || Double.IsInfinity(creationTime)
                || creationTime <= 0)
            {
                Console.WriteLine("0\tinvalid-input");
                continue;
            }

            Console.WriteLine(processId.ToString(CultureInfo.InvariantCulture) + "\t" + TrimProcess(processId, creationTime));
        }
        return 0;
    }
}
