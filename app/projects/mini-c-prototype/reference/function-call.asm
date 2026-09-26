.data

.text
# function twice
twice:
# function prologue
#  make room for $fp old value
addi $sp,$sp,-4
#  Push frame pointer onto the stack
sw $fp,0($sp)
#  initialize this frame's $fp
addiu $fp,$sp,0
#  make room for return address -- slides hints we should always do this
addiu $sp,$sp,-4
# push return address onto the stack
sw $ra,0($sp)
addiu $sp,$sp,-4
addiu $sp,$sp,-4
sw $t0,0($sp)
addiu $sp,$sp,-4
sw $t1,0($sp)
# function body
# Copy return value on the stack

# addr of local var n : size = 4, type int
addi $t0,$fp,8
lw $t1,0($t0)

# addr of local var n : size = 4, type int
addi $t0,$fp,8
lw $t0,0($t0)
addu $t0,$t1,$t0
sw $t0,4($fp)
j twice_epilogue
# function epilogue
twice_epilogue:
lw $t1,0($sp)
addiu $sp,$sp,4
lw $t0,0($sp)
addiu $sp,$sp,4
# restore stack pointer
addi $sp,$fp,4
# restore return address from the stack
lw $ra,-4($fp)
# restore frame pointer
lw $fp,0($fp)
# jump to return address
jr $ra

.text
# function main
# int main()
.globl main
main:
# function prologue
#  make room for $fp old value
addi $sp,$sp,-4
#  Push frame pointer onto the stack
sw $fp,0($sp)
#  initialize this frame's $fp
addiu $fp,$sp,0
addiu $sp,$sp,-4
addiu $sp,$sp,-4
sw $t0,0($sp)
# function body
# Copy return value on the stack

# Precall convention
# Push args onto stack
li $t0,6
addi $sp,$sp,-4
sw $t0,0($sp)
addi $sp,$sp,-4
jal twice
# Read return value from stack address
lw $t0,0($sp)
# Reset stack pointer
addi $sp,$sp,8
sw $t0,4($fp)
j main_epilogue
# function epilogue
main_epilogue:
lw $t0,0($sp)
addiu $sp,$sp,4
# restore stack pointer
addi $sp,$fp,4
# restore frame pointer
lw $fp,0($fp)

# main exit syscall
li $v0,10
syscall

