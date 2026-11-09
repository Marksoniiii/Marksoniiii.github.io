---
title: leetcode hot-100 (8.25-stage-1)
description: 速通 hot-100 (Aided by AI) 的全部过程
pubDatetime: 2026-08-25T02:04:53.081Z
modDatetime: null
featured: false
draft: false
tags:
  - leetcode
  - note
  - code
---

---

## 139 （字符串拆分）

这道题本质是 **字符串拆分 + 动态规划（DP）**，

### 思路

我们定义：

`dp[i]` 表示 **字符串 `s` 的前 i 个字符是否可以被字典中的单词拼接出来**。

状态转移：

- 枚举最后一个单词的位置 `j`
- 如果：

  1. `dp[j] == True`（前 j 个字符已经可以拆分）
  2. `s[j:i]` 在字典中

那么：

```
dp[i] = True
```

初始化：

```
dp[0] = True
```

表示空字符串可以被拆分。

最后返回：

```
dp[len(s)]
```

例如：

```
s = "leetcode"
dict = ["leet","code"]

dp[0]=True

i=4:
s[0:4]="leet" 在字典
dp[4]=True

i=8:
s[4:8]="code" 在字典
dp[8]=True

返回 True
```

时间复杂度：

- 外层枚举 i
- 内层枚举 j

所以：

```
O(n²)
```

空间：

```
O(n)
```

---

### Python 实现

```python
class Solution:
    def wordBreak(self, s: str, wordDict: list[str]) -> bool:
        word_set = set(wordDict)

        n = len(s)
        dp = [False] * (n + 1)

        # 空字符串可以被拆分
        dp[0] = True

        for i in range(1, n + 1):
            for j in range(i):
                if dp[j] and s[j:i] in word_set:
                    dp[i] = True
                    break

        return dp[n]
```

---

### 一个小优化

如果字典单词长度有限，可以减少枚举范围：

```python
class Solution:
    def wordBreak(self, s: str, wordDict: list[str]) -> bool:
        word_set = set(wordDict)
        max_len = max(map(len, wordDict))

        n = len(s)
        dp = [False] * (n + 1)
        dp[0] = True

        for i in range(1, n + 1):
            for j in range(max(0, i - max_len), i):
                if dp[j] and s[j:i] in word_set:
                    dp[i] = True
                    break

        return dp[n]
```

这个版本在字典较大时更快，因为不会尝试明显不可能的长字符串。

这道题属于 Hot 100 中比较经典的 **“字符串 DP 模板题”**，核心记住一句话即可：

> `dp[i]` 表示前 i 个字符能不能拆，当前状态由之前某个可拆位置 + 一个字典单词决定。

---

## 136. 只出现一次的数字

### 核心思路：异或运算

异或有三个重要性质：

1. **任何数字和自己异或等于 0**

```
a ^ a = 0
```

例如：

```
5 ^ 5 = 0
```

2. **任何数字和 0 异或还是自己**

```
a ^ 0 = a
```

3. **异或满足交换律和结合律**

```
a ^ b ^ a = a ^ a ^ b = 0 ^ b = b
```

因此：

如果数组：

```
[4,1,2,1,2]
```

全部异或：

```
4 ^ 1 ^ 2 ^ 1 ^ 2
```

调整顺序：

```
(1 ^ 1) ^ (2 ^ 2) ^ 4
```

得到：

```
0 ^ 0 ^ 4
```

结果：

```
4
```

重复出现的数字全部抵消，只留下出现一次的数字。

代码实现：

### Python代码

```python
class Solution:
    def singleNumber(self, nums: list[int]) -> int:
        ans = 0

        for num in nums:
            ans ^= num

        return ans
```

---

LeetCode 647「回文子串」，核心考察 **中心扩展法（Center Expansion）**，也是 Hot 100 中非常经典的字符串题。

题目要求：

> 找出字符串中所有的回文子串数量。

注意：

- 子串必须连续
- 单个字符也是回文串
- 相同内容但不同位置算不同回文串

例如：

```
s = "aaa"
```

回文串：

```
a
a
a
aa
aa
aaa
```

答案：

```
6
```

---

## 思路：中心扩展

一个回文串一定有一个中心。

例如：

### 奇数长度回文

```
aba
 ^
中心是 b
```

向两边扩展：

```
a b a
↑   ↑
```

相等，所以是回文。

---

### 偶数长度回文

```
abba

 abba
  ↑↑
中心在两个 b 之间
```

所以每个回文串有两种中心：

1. 一个字符作为中心：

```
aba
```

2. 两个字符之间作为中心：

```
abba
```

因此长度为 n 的字符串共有：

```
2n - 1
```

个中心。

---

## 算法流程

遍历每个中心：

对于每个 i：

### 情况1：奇数回文

中心：

```
i
```

左右：

```
i, i
```

扩展：

```
while s[left] == s[right]:
    count += 1
    left--
    right++
```

---

### 情况2：偶数回文

中心：

```
i 和 i+1之间
```

左右：

```
i, i+1
```

同样扩展。

---

## Python代码

```python
class Solution:
    def countSubstrings(self, s: str) -> int:
        n = len(s)
        count = 0

        def expand(left, right):
            nonlocal count

            while left >= 0 and right < n and s[left] == s[right]:
                count += 1
                left -= 1
                right += 1

        for i in range(n):
            # 奇数长度回文
            expand(i, i)

            # 偶数长度回文
            expand(i, i + 1)

        return count
```

---

LeetCode 128「最长连续序列」，核心考察 **哈希表 + 线性扫描**。

题目要求：

- 给一个**无序数组**
- 找最长连续数字序列长度
- 要求 `O(n)` 时间

例如：

```python
nums = [100,4,200,1,3,2]
```

排序后：

```text
[1,2,3,4,100,200]
```

最长连续：

```text
1,2,3,4
```

答案：

```text
4
```

但是排序需要：

```text
O(nlogn)
```

不满足要求。

---

## 核心思路：寻找连续序列的起点

我们使用集合：

```python
num_set = set(nums)
```

例如：

```text
[100,4,200,1,3,2]

set:
{100,4,200,1,3,2}
```

对于每个数字 `x`：

如果：

```python
x - 1 不存在
```

说明：

> x 是一个连续序列的起点

例如：

```text
1,2,3,4
```

只有：

```
1
```

满足：

```
0 不存在
```

所以从 1 开始扩展。

---

## 扩展过程

假设：

```python
x = 1
```

不断检查：

```python
2 是否存在
3 是否存在
4 是否存在
5 是否存在
```

得到长度：

```
4
```

更新答案。

---

## 为什么是 O(n)？

关键：

不是每个数字都扩展。

例如：

```text
1,2,3,4
```

只有 1 会启动：

```
1 -> 2 -> 3 -> 4
```

2、3、4 都跳过。

因为：

```python
2-1 存在
3-1 存在
4-1 存在
```

所以每个数字最多被访问一次。

时间复杂度：

```
O(n)
```

空间：

```
O(n)
```

---

## Python实现

```python
class Solution:
    def longestConsecutive(self, nums: list[int]) -> int:
        num_set = set(nums)

        longest = 0

        for num in num_set:
            # 判断是否为连续序列起点
            if num - 1 not in num_set:

                length = 1
                current = num

                while current + 1 in num_set:
                    current += 1
                    length += 1

                longest = max(longest, length)

        return longest
```

---
