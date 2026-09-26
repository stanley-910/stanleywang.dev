.data

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
addiu $sp,$sp,-4
sw $t1,0($sp)
# function body
# Copy return value on the stack
li $t1,4
li $t0,2
addu $t0,$t1,$t0
li $t1,3
mult $t0,$t1
mflo $t0
sw $t0,4($fp)
j main_epilogue
# function epilogue
main_epilogue:
lw $t1,0($sp)
addiu $sp,$sp,4
lw $t0,0($sp)
addiu $sp,$sp,4
# restore stack pointer
addi $sp,$fp,4
# restore frame pointer
lw $fp,0($fp)

# main exit syscall
li $v0,10
syscall

